import type { SupabaseClient } from "@supabase/supabase-js";
import { getConnector } from "@/lib/connectors";
import { getServiceClient } from "@/lib/supabase-server";
import type { Invoice, Cart, ReviewTarget, Lead, InboxMessage } from "@/lib/runtime";
import type { Trace } from "@/lib/trace";

type StoredConnection = {
  id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  external_id: string | null;
};

const CONN_COLS = "id, provider, access_token, refresh_token, expires_at, external_id";

/** Refresh an OAuth access token using the connector's token endpoint. */
async function refreshAccessToken(
  connectorId: string,
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  const c = getConnector(connectorId);
  if (!c || !refreshToken) return null;
  const clientId = process.env[c.idEnv];
  const clientSecret = process.env[c.secretEnv];
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (c.tokenAuth === "basic") {
    headers.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  }
  try {
    const res = await fetch(c.tokenUrl, { method: "POST", headers, body, cache: "no-store" });
    const t = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    return t.access_token ? { access_token: t.access_token, refresh_token: t.refresh_token, expires_in: t.expires_in } : null;
  } catch {
    return null;
  }
}

/** A valid access token — refreshes + persists if the stored one is expiring. */
async function ensureAccessToken(
  supabase: SupabaseClient,
  connectorId: string,
  conn: StoredConnection
): Promise<string | null> {
  const now = Date.now();
  const exp = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (conn.access_token && exp - 60_000 > now) return conn.access_token; // still valid (60s buffer)
  if (!conn.refresh_token) return conn.access_token;

  const refreshed = await refreshAccessToken(connectorId, conn.refresh_token);
  if (!refreshed) return conn.access_token;

  const newExpiry = refreshed.expires_in ? new Date(now + refreshed.expires_in * 1000).toISOString() : null;
  await supabase
    .from("connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? conn.refresh_token,
      expires_at: newExpiry,
    })
    .eq("id", conn.id);
  return refreshed.access_token;
}

// ── QuickBooks Online ────────────────────────────────────────────────────────

type QBInvoice = {
  Id?: string;
  DocNumber?: string;
  DueDate?: string;
  Balance?: number | string;
  CustomerRef?: { name?: string };
  BillEmail?: { Address?: string };
};

/** Query overdue invoices (Balance > 0, past due date) from QuickBooks. */
async function fetchQuickBooksOverdueInvoices(accessToken: string, realmId: string): Promise<Invoice[]> {
  const base =
    process.env.QUICKBOOKS_ENV === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";
  const query = encodeURIComponent("SELECT * FROM Invoice WHERE Balance > '0' ORDER BY DueDate MAXRESULTS 50");
  const res = await fetch(`${base}/v3/company/${realmId}/query?query=${query}&minorversion=65`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { QueryResponse?: { Invoice?: QBInvoice[] } };
  const rows = data?.QueryResponse?.Invoice ?? [];
  const today = Date.now();
  return rows
    .map((inv) => {
      const due = inv?.DueDate ? new Date(inv.DueDate).getTime() : today;
      return {
        number: String(inv?.DocNumber ?? inv?.Id ?? ""),
        customer: inv?.CustomerRef?.name ?? "",
        email: inv?.BillEmail?.Address ?? "",
        amount: Number(inv?.Balance) || 0,
        daysOverdue: Math.max(0, Math.floor((today - due) / 86_400_000)),
      };
    })
    .filter((v) => v.daysOverdue > 0);
}

/**
 * Pull overdue invoices from a client's connected QuickBooks (by ingest key).
 * Returns { clientId, invoices } or null if no client. Traces the tool spans.
 */
export async function pullOverdueInvoices(
  ingestKey: string,
  trace?: Trace
): Promise<{ clientId: string; invoices: Invoice[] } | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data: client } = await supabase.from("clients").select("id").eq("ingest_key", ingestKey).maybeSingle();
  if (!client) return null;

  const { data: conn } = await supabase
    .from("connections")
    .select(CONN_COLS)
    .eq("client_id", client.id)
    .eq("provider", "QuickBooks Online")
    .eq("status", "connected")
    .maybeSingle();
  if (!conn || !conn.external_id) return { clientId: client.id, invoices: [] };

  trace?.mark("tool.quickbooks.token");
  const token = await ensureAccessToken(supabase, "quickbooks", conn as StoredConnection);
  if (!token) return { clientId: client.id, invoices: [] };

  trace?.mark("tool.quickbooks.fetch.start");
  const invoices = await fetchQuickBooksOverdueInvoices(token, conn.external_id);
  trace?.mark("tool.quickbooks.fetch.end", { invoices: invoices.length });
  return { clientId: client.id, invoices };
}

// ── Workday (RaaS / report-as-a-service) ─────────────────────────────────────

/**
 * Fetch a Workday report as JSON. Workday tasks are tenant-specific; the common
 * integration path is a custom report exposed as RaaS. The report URL is stored
 * per-connection (external_id) or via WORKDAY_REPORT_URL.
 */
export async function fetchWorkdayReport(accessToken: string, reportUrl: string): Promise<Record<string, unknown>[]> {
  try {
    const url = `${reportUrl}${reportUrl.includes("?") ? "&" : "?"}format=json`;
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { Report_Entry?: Record<string, unknown>[]; data?: Record<string, unknown>[] };
    return data?.Report_Entry ?? data?.data ?? [];
  } catch {
    return [];
  }
}

/** Pull Workday report rows for a client (report URL from the connection or env). */
export async function pullWorkdayReport(
  ingestKey: string
): Promise<{ clientId: string; rows: Record<string, unknown>[] } | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data: client } = await supabase.from("clients").select("id").eq("ingest_key", ingestKey).maybeSingle();
  if (!client) return null;

  const { data: conn } = await supabase
    .from("connections")
    .select(CONN_COLS)
    .eq("client_id", client.id)
    .eq("provider", "Workday")
    .eq("status", "connected")
    .maybeSingle();
  if (!conn) return { clientId: client.id, rows: [] };

  const reportUrl = conn.external_id || process.env.WORKDAY_REPORT_URL;
  if (!reportUrl) return { clientId: client.id, rows: [] };

  const token = await ensureAccessToken(supabase, "workday", conn as StoredConnection);
  if (!token) return { clientId: client.id, rows: [] };
  const rows = await fetchWorkdayReport(token, reportUrl);
  return { clientId: client.id, rows };
}

// ── Shared helpers ───────────────────────────────────────────────────────────

async function clientId(ingestKey: string): Promise<{ supabase: SupabaseClient; id: string } | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data } = await supabase.from("clients").select("id").eq("ingest_key", ingestKey).maybeSingle();
  return data ? { supabase, id: data.id } : null;
}

async function connectedConnection(
  supabase: SupabaseClient,
  cid: string,
  providerName: string
): Promise<StoredConnection | null> {
  const { data } = await supabase
    .from("connections")
    .select(CONN_COLS)
    .eq("client_id", cid)
    .eq("provider", providerName)
    .eq("status", "connected")
    .maybeSingle();
  return (data as StoredConnection) ?? null;
}

// ── Shopify (e-commerce) ─────────────────────────────────────────────────────

const SHOPIFY_API = "2024-10";

type ShopifyCheckout = {
  email?: string;
  phone?: string;
  total_price?: string;
  abandoned_checkout_url?: string;
  customer?: { first_name?: string; last_name?: string; phone?: string };
  line_items?: { title?: string }[];
};
type ShopifyOrder = {
  email?: string;
  phone?: string;
  customer?: { first_name?: string; last_name?: string; phone?: string };
  line_items?: { title?: string }[];
};

const fullName = (c?: { first_name?: string; last_name?: string }) =>
  [c?.first_name, c?.last_name].filter(Boolean).join(" ");

async function shopifyGet<T>(shop: string, token: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API}/${path}`, {
      headers: { "X-Shopify-Access-Token": token, accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Pull abandoned checkouts from a client's connected Shopify → recovery carts. */
export async function pullAbandonedCheckouts(
  ingestKey: string,
  trace?: Trace
): Promise<{ clientId: string; carts: Cart[] } | null> {
  const c = await clientId(ingestKey);
  if (!c) return null;
  const conn = await connectedConnection(c.supabase, c.id, "Shopify");
  const shop = conn?.external_id || process.env.SHOPIFY_SHOP;
  if (!conn || !shop) return { clientId: c.id, carts: [] };
  const token = await ensureAccessToken(c.supabase, "shopify", conn);
  if (!token) return { clientId: c.id, carts: [] };
  trace?.mark("tool.shopify.checkouts.start");
  const data = await shopifyGet<{ checkouts?: ShopifyCheckout[] }>(shop, token, "checkouts.json?limit=50");
  const carts: Cart[] = (data?.checkouts ?? []).map((k) => ({
    customer: fullName(k.customer) || k.email || "",
    email: k.email ?? "",
    phone: k.phone ?? k.customer?.phone ?? "",
    total: Number(k.total_price) || 0,
    url: k.abandoned_checkout_url ?? "",
    items: (k.line_items ?? []).map((li) => li.title).filter(Boolean).slice(0, 5).join(", "),
  }));
  trace?.mark("tool.shopify.checkouts.end", { carts: carts.length });
  return { clientId: c.id, carts };
}

/** Pull recent paid orders from Shopify → review-request targets. */
export async function pullRecentOrders(
  ingestKey: string,
  trace?: Trace
): Promise<{ clientId: string; targets: ReviewTarget[] } | null> {
  const c = await clientId(ingestKey);
  if (!c) return null;
  const conn = await connectedConnection(c.supabase, c.id, "Shopify");
  const shop = conn?.external_id || process.env.SHOPIFY_SHOP;
  if (!conn || !shop) return { clientId: c.id, targets: [] };
  const token = await ensureAccessToken(c.supabase, "shopify", conn);
  if (!token) return { clientId: c.id, targets: [] };
  trace?.mark("tool.shopify.orders.start");
  const data = await shopifyGet<{ orders?: ShopifyOrder[] }>(
    shop,
    token,
    "orders.json?status=any&financial_status=paid&limit=25"
  );
  const targets: ReviewTarget[] = (data?.orders ?? []).map((o) => ({
    customer: fullName(o.customer) || o.email || "",
    email: o.email ?? "",
    phone: o.phone ?? o.customer?.phone ?? "",
    service: (o.line_items ?? []).map((li) => li.title).filter(Boolean).slice(0, 3).join(", "),
  }));
  trace?.mark("tool.shopify.orders.end", { targets: targets.length });
  return { clientId: c.id, targets };
}

// ── Zendesk (support) ────────────────────────────────────────────────────────

type ZendeskTicket = {
  id?: number;
  subject?: string;
  description?: string;
  via?: { source?: { from?: { address?: string } } };
};

/** Pull open Zendesk tickets → inbox messages for the triage agent. */
export async function pullOpenTickets(
  ingestKey: string,
  trace?: Trace
): Promise<{ clientId: string; messages: InboxMessage[] } | null> {
  const c = await clientId(ingestKey);
  if (!c) return null;
  const sub = process.env.ZENDESK_SUBDOMAIN;
  const conn = await connectedConnection(c.supabase, c.id, "Zendesk");
  if (!conn || !sub) return { clientId: c.id, messages: [] };
  const token = await ensureAccessToken(c.supabase, "zendesk", conn);
  if (!token) return { clientId: c.id, messages: [] };
  trace?.mark("tool.zendesk.tickets.start");
  try {
    const res = await fetch(`https://${sub}.zendesk.com/api/v2/tickets.json?sort_order=desc`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return { clientId: c.id, messages: [] };
    const data = (await res.json()) as { tickets?: ZendeskTicket[] };
    const messages: InboxMessage[] = (data.tickets ?? []).slice(0, 20).map((t) => ({
      from: t.via?.source?.from?.address ?? `ticket #${t.id ?? "?"}`,
      subject: t.subject ?? "(no subject)",
      body: t.description ?? "",
    }));
    trace?.mark("tool.zendesk.tickets.end", { messages: messages.length });
    return { clientId: c.id, messages };
  } catch {
    return { clientId: c.id, messages: [] };
  }
}

// ── HubSpot (CRM leads) ──────────────────────────────────────────────────────

type HubSpotContact = {
  properties?: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    hs_lead_status?: string;
    message?: string;
  };
};

/** Pull recent HubSpot contacts → leads for the qualification agent. */
export async function pullNewLeads(
  ingestKey: string,
  trace?: Trace
): Promise<{ clientId: string; leads: Lead[] } | null> {
  const c = await clientId(ingestKey);
  if (!c) return null;
  const conn = await connectedConnection(c.supabase, c.id, "HubSpot");
  if (!conn) return { clientId: c.id, leads: [] };
  const token = await ensureAccessToken(c.supabase, "hubspot", conn);
  if (!token) return { clientId: c.id, leads: [] };
  trace?.mark("tool.hubspot.contacts.start");
  try {
    const res = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts?limit=25&properties=firstname,lastname,email,phone,hs_lead_status,message&sort=-createdate",
      { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return { clientId: c.id, leads: [] };
    const data = (await res.json()) as { results?: HubSpotContact[] };
    const leads: Lead[] = (data.results ?? []).map((r) => ({
      name: [r.properties?.firstname, r.properties?.lastname].filter(Boolean).join(" "),
      email: r.properties?.email ?? "",
      phone: r.properties?.phone ?? "",
      source: r.properties?.hs_lead_status ?? "HubSpot",
      message: r.properties?.message ?? "",
    }));
    trace?.mark("tool.hubspot.contacts.end", { leads: leads.length });
    return { clientId: c.id, leads };
  } catch {
    return { clientId: c.id, leads: [] };
  }
}

// ── Twilio (SMS send + inbound routing) ──────────────────────────────────────

type TwilioCreds = { key?: string; secret?: string; from?: string }; // SID, auth token, from number

function parseApiKey(access_token: string | null): TwilioCreds | null {
  if (!access_token) return null;
  try {
    return JSON.parse(access_token) as TwilioCreds;
  } catch {
    return null;
  }
}

/** Send an SMS through a client's connected Twilio (API-key connection). */
export async function sendSmsForClient(
  supabase: SupabaseClient,
  cid: string,
  to: string,
  body: string
): Promise<boolean> {
  const conn = await connectedConnection(supabase, cid, "Twilio");
  const creds = parseApiKey(conn?.access_token ?? null);
  if (!creds?.key || !creds.secret || !creds.from) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.key}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${creds.key}:${creds.secret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: creds.from, To: to, Body: body }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Find which client owns the inbound Twilio number (matches the stored "from"). */
export async function clientForInboundNumber(toNumber: string): Promise<string | null> {
  const supabase = getServiceClient();
  if (!supabase || !toNumber) return null;
  const { data } = await supabase
    .from("connections")
    .select("client_id, access_token")
    .eq("provider", "Twilio")
    .eq("status", "connected");
  for (const row of (data ?? []) as { client_id: string; access_token: string | null }[]) {
    if (parseApiKey(row.access_token)?.from === toNumber) return row.client_id;
  }
  return null;
}
