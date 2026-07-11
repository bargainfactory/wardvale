import type { SupabaseClient } from "@supabase/supabase-js";
import { getConnector } from "@/lib/connectors";
import { getServiceClient } from "@/lib/supabase-server";
import type { Invoice } from "@/lib/runtime";
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
