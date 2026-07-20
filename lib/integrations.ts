import type { SupabaseClient } from "@supabase/supabase-js";
import { getConnector } from "@/lib/connectors";
import { getServiceClient } from "@/lib/supabase-server";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { Invoice, Cart, ReviewTarget, Lead, InboxMessage, LapsedCustomer, OpenQuote, AppointmentItem } from "@/lib/runtime";
import type { Trace } from "@/lib/trace";
import { reportWarning } from "@/lib/report";

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

/** A valid access token — refreshes + persists if the stored one is expiring.
 *  Tokens are encrypted at rest, so we decrypt on read and re-encrypt on write. */
async function ensureAccessToken(
  supabase: SupabaseClient,
  connectorId: string,
  conn: StoredConnection
): Promise<string | null> {
  const now = Date.now();
  const accessToken = decryptSecret(conn.access_token);
  const refreshToken = decryptSecret(conn.refresh_token);
  const exp = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (accessToken && exp - 60_000 > now) return accessToken; // still valid (60s buffer)
  if (!refreshToken) return accessToken;

  const refreshed = await refreshAccessToken(connectorId, refreshToken);
  if (!refreshed) return accessToken;

  const newExpiry = refreshed.expires_in ? new Date(now + refreshed.expires_in * 1000).toISOString() : null;
  await supabase
    .from("connections")
    .update({
      access_token: encryptSecret(refreshed.access_token),
      refresh_token: encryptSecret(refreshed.refresh_token ?? refreshToken),
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
async function fetchQuickBooksOverdueInvoices(accessToken: string, realmId: string): Promise<Invoice[] | null> {
  const base =
    process.env.QUICKBOOKS_ENV === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";
  const query = encodeURIComponent("SELECT * FROM Invoice WHERE Balance > '0' ORDER BY DueDate MAXRESULTS 50");
  const res = await fetch(`${base}/v3/company/${realmId}/query?query=${query}&minorversion=65`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
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
  if (invoices === null) {
    reportWarning("QuickBooks invoice pull failed", { source: "pull.quickbooks", clientId: client.id });
    trace?.flag("source_error", "quickbooks");
    return { clientId: client.id, invoices: [] };
  }
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
  if (data === null) {
    reportWarning("Shopify checkouts pull failed", { source: "pull.shopify", clientId: c.id });
    trace?.flag("source_error", "shopify");
    return { clientId: c.id, carts: [] };
  }
  const carts: Cart[] = (data.checkouts ?? []).map((k) => ({
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
  if (data === null) {
    reportWarning("Shopify orders pull failed", { source: "pull.shopify", clientId: c.id });
    trace?.flag("source_error", "shopify");
    return { clientId: c.id, targets: [] };
  }
  const targets: ReviewTarget[] = (data.orders ?? []).map((o) => ({
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
    if (!res.ok) {
      reportWarning(`Zendesk tickets pull failed (${res.status})`, { source: "pull.zendesk", clientId: c.id });
      trace?.flag("source_error", "zendesk");
      return { clientId: c.id, messages: [] };
    }
    const data = (await res.json()) as { tickets?: ZendeskTicket[] };
    const messages: InboxMessage[] = (data.tickets ?? []).slice(0, 20).map((t) => ({
      from: t.via?.source?.from?.address ?? `ticket #${t.id ?? "?"}`,
      subject: t.subject ?? "(no subject)",
      body: t.description ?? "",
    }));
    trace?.mark("tool.zendesk.tickets.end", { messages: messages.length });
    return { clientId: c.id, messages };
  } catch (err) {
    reportWarning("Zendesk tickets pull threw", { source: "pull.zendesk", clientId: c.id, detail: { err: String(err) } });
    trace?.flag("source_error", "zendesk");
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
    if (!res.ok) {
      reportWarning(`HubSpot contacts pull failed (${res.status})`, { source: "pull.hubspot", clientId: c.id });
      trace?.flag("source_error", "hubspot");
      return { clientId: c.id, leads: [] };
    }
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
  } catch (err) {
    reportWarning("HubSpot contacts pull threw", { source: "pull.hubspot", clientId: c.id, detail: { err: String(err) } });
    trace?.flag("source_error", "hubspot");
    return { clientId: c.id, leads: [] };
  }
}

// ── Twilio (SMS send + inbound routing) ──────────────────────────────────────

type TwilioCreds = { key?: string; secret?: string; from?: string }; // SID, auth token, from number

function parseApiKey(access_token: string | null): TwilioCreds | null {
  const raw = decryptSecret(access_token);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TwilioCreds;
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

// ── Wave 2 pulls ─────────────────────────────────────────────────────────────

type ShopifyOrderFull = {
  email?: string;
  phone?: string;
  created_at?: string;
  total_price?: string;
  customer?: { first_name?: string; last_name?: string; phone?: string };
  line_items?: { title?: string }[];
};

/**
 * Pull lapsed repeat customers from Shopify → win-back targets. A customer is
 * "lapsed" when they've ordered 2+ times but their latest order is 45+ days
 * old — regulars who quietly stopped, the highest-converting outreach segment
 * from the July 2026 pain research.
 */
export async function pullLapsedCustomers(
  ingestKey: string,
  trace?: Trace
): Promise<{ clientId: string; lapsed: LapsedCustomer[] } | null> {
  const c = await clientId(ingestKey);
  if (!c) return null;
  const conn = await connectedConnection(c.supabase, c.id, "Shopify");
  const shop = conn?.external_id || process.env.SHOPIFY_SHOP;
  if (!conn || !shop) return { clientId: c.id, lapsed: [] };
  const token = await ensureAccessToken(c.supabase, "shopify", conn);
  if (!token) return { clientId: c.id, lapsed: [] };

  trace?.mark("tool.shopify.lapsed.start");
  const data = await shopifyGet<{ orders?: ShopifyOrderFull[] }>(
    shop,
    token,
    "orders.json?status=any&financial_status=paid&limit=250&fields=email,phone,created_at,total_price,customer,line_items"
  );
  if (data === null) {
    reportWarning("Shopify lapsed-customer pull failed", { source: "pull.shopify", clientId: c.id });
    trace?.flag("source_error", "shopify");
    return { clientId: c.id, lapsed: [] };
  }

  // Group by customer email → order count, last order date, lifetime spend.
  const byCustomer = new Map<
    string,
    { customer: string; phone: string; orders: number; lastAt: number; lastItems: string; total: number }
  >();
  for (const o of data.orders ?? []) {
    const email = (o.email ?? "").toLowerCase();
    if (!email) continue;
    const at = o.created_at ? new Date(o.created_at).getTime() : 0;
    const cur = byCustomer.get(email) ?? {
      customer: fullName(o.customer) || email,
      phone: o.phone ?? o.customer?.phone ?? "",
      orders: 0,
      lastAt: 0,
      lastItems: "",
      total: 0,
    };
    cur.orders += 1;
    cur.total += Number(o.total_price) || 0;
    if (at > cur.lastAt) {
      cur.lastAt = at;
      cur.lastItems = (o.line_items ?? []).map((li) => li.title).filter(Boolean).slice(0, 3).join(", ");
    }
    byCustomer.set(email, cur);
  }

  const now = Date.now();
  const LAPSE_DAYS = 45;
  const lapsed: LapsedCustomer[] = [];
  for (const [email, v] of byCustomer) {
    const daysSince = Math.floor((now - v.lastAt) / 86_400_000);
    if (v.orders >= 2 && daysSince >= LAPSE_DAYS) {
      lapsed.push({
        customer: v.customer,
        email,
        phone: v.phone,
        lastPurchase: v.lastItems,
        daysSince,
        totalSpent: Math.round(v.total),
      });
    }
  }
  lapsed.sort((a, b) => (b.totalSpent ?? 0) - (a.totalSpent ?? 0));
  trace?.mark("tool.shopify.lapsed.end", { lapsed: lapsed.length });
  return { clientId: c.id, lapsed: lapsed.slice(0, 20) };
}

type QBEstimate = {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  TotalAmt?: number;
  TxnStatus?: string;
  CustomerRef?: { name?: string };
  BillEmail?: { Address?: string };
  CustomerMemo?: { value?: string };
};

async function fetchQuickBooksOpenEstimates(accessToken: string, realmId: string): Promise<OpenQuote[] | null> {
  const base =
    process.env.QUICKBOOKS_ENV === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";
  const query = encodeURIComponent("SELECT * FROM Estimate WHERE TxnStatus = 'Pending' ORDER BY TxnDate DESC MAXRESULTS 50");
  const res = await fetch(`${base}/v3/company/${realmId}/query?query=${query}&minorversion=65`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { QueryResponse?: { Estimate?: QBEstimate[] } };
  const rows = data?.QueryResponse?.Estimate ?? [];
  const today = Date.now();
  return rows.map((e) => {
    const at = e?.TxnDate ? new Date(e.TxnDate).getTime() : today;
    return {
      number: String(e?.DocNumber ?? e?.Id ?? ""),
      customer: e?.CustomerRef?.name ?? "",
      email: e?.BillEmail?.Address ?? "",
      amount: Number(e?.TotalAmt) || 0,
      service: e?.CustomerMemo?.value ?? "",
      daysOld: Math.max(0, Math.floor((today - at) / 86_400_000)),
    };
  });
}

/**
 * Pull open (pending) estimates from a client's connected QuickBooks → quote
 * follow-up targets. Quotes older than a couple of days are the ones dying in
 * silence — the #1 cross-vertical revenue leak in the pain research.
 */
export async function pullOpenEstimates(
  ingestKey: string,
  trace?: Trace
): Promise<{ clientId: string; quotes: OpenQuote[] } | null> {
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
  if (!conn || !conn.external_id) return { clientId: client.id, quotes: [] };

  trace?.mark("tool.quickbooks.token");
  const token = await ensureAccessToken(supabase, "quickbooks", conn as StoredConnection);
  if (!token) return { clientId: client.id, quotes: [] };

  trace?.mark("tool.quickbooks.estimates.start");
  const quotes = await fetchQuickBooksOpenEstimates(token, conn.external_id);
  if (quotes === null) {
    reportWarning("QuickBooks estimates pull failed", { source: "pull.quickbooks", clientId: client.id });
    trace?.flag("source_error", "quickbooks");
    return { clientId: client.id, quotes: [] };
  }
  // Only chase quotes that have had a beat to breathe (2+ days old).
  const aged = quotes.filter((q) => (q.daysOld ?? 0) >= 2);
  trace?.mark("tool.quickbooks.estimates.end", { quotes: aged.length });
  return { clientId: client.id, quotes: aged };
}

// ── Google Calendar → no-show shield ─────────────────────────────────────────

export type GCalEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email?: string; displayName?: string; responseStatus?: string; self?: boolean; organizer?: boolean }[];
};

/**
 * Pure mapper: upcoming calendar events → no-show-shield confirm items.
 * Exported for tests. Rules:
 *  - skip cancelled and all-day events (no dateTime);
 *  - skip events with no external attendee (self/organizer excluded);
 *  - skip attendees who DECLINED (they told us; nothing to confirm);
 *  - risk flags an attendee who hasn't accepted the invite — the exact cohort
 *    most likely to no-show per the July 2026 pain research;
 *  - only events starting between nowMs+2h and nowMs+48h (don't ping someone
 *    minutes before, don't confirm next week yet).
 */
export function calendarEventsToAppointments(events: GCalEvent[], nowMs: number, tz: string): AppointmentItem[] {
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz || "America/New_York",
  });
  const minStart = nowMs + 2 * 3_600_000;
  const maxStart = nowMs + 48 * 3_600_000;

  const out: AppointmentItem[] = [];
  for (const ev of events) {
    if (ev.status === "cancelled") continue; // backfill flow is a later step
    const startIso = ev.start?.dateTime;
    if (!startIso) continue; // all-day events aren't appointments
    const startMs = new Date(startIso).getTime();
    if (Number.isNaN(startMs) || startMs < minStart || startMs > maxStart) continue;

    const guest = (ev.attendees ?? []).find(
      (a) => a?.email && !a.self && !a.organizer && a.responseStatus !== "declined"
    );
    if (!guest) continue;

    out.push({
      customer: guest.displayName || (guest.email ?? "").split("@")[0],
      email: guest.email ?? "",
      when: fmt.format(new Date(startMs)),
      service: (ev.summary ?? "").slice(0, 200),
      kind: "confirm",
      risk: guest.responseStatus === "accepted" ? "" : "hasn't responded to the invite",
    });
    if (out.length >= 20) break;
  }
  return out;
}

/**
 * Pull the next 48h of appointments from a client's connected Google Calendar
 * (provider "Google Workspace" — the connector's calendar.events scope already
 * covers reads) → confirm items for the no-show shield.
 */
export async function pullUpcomingAppointments(
  ingestKey: string,
  trace?: Trace
): Promise<{ clientId: string; appointments: AppointmentItem[] } | null> {
  const c = await clientId(ingestKey);
  if (!c) return null;
  const conn = await connectedConnection(c.supabase, c.id, "Google Workspace");
  if (!conn) return { clientId: c.id, appointments: [] };
  const token = await ensureAccessToken(c.supabase, "google", conn);
  if (!token) return { clientId: c.id, appointments: [] };

  // Format times in the client's own timezone so drafts read naturally.
  const { data: cl } = await c.supabase.from("clients").select("timezone").eq("id", c.id).maybeSingle();
  const tz = (cl as { timezone?: string } | null)?.timezone || "America/New_York";

  const now = Date.now();
  const timeMin = encodeURIComponent(new Date(now).toISOString());
  const timeMax = encodeURIComponent(new Date(now + 48 * 3_600_000).toISOString());
  trace?.mark("tool.gcal.events.start");
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`,
      { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) {
      reportWarning("Google Calendar pull failed", { source: "pull.gcal", clientId: c.id });
      trace?.flag("source_error", "gcal");
      return { clientId: c.id, appointments: [] };
    }
    const data = (await res.json()) as { items?: GCalEvent[] };
    const appointments = calendarEventsToAppointments(data.items ?? [], now, tz);
    trace?.mark("tool.gcal.events.end", { appointments: appointments.length });
    return { clientId: c.id, appointments };
  } catch {
    trace?.flag("source_error", "gcal");
    return { clientId: c.id, appointments: [] };
  }
}
