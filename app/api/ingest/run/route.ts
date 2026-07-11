import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Run-event ingestion for a client's automations (Zapier/Make → here).
 * Authenticated by the per-client `ingest_key` (Bearer token or x-api-key).
 * Each event appends a row to `runs`, feeding the portal + ROI + benchmarks.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`ingest:${clientIp(req)}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const key =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-api-key")?.trim() ||
    "";
  if (!key) return NextResponse.json({ error: "missing_api_key" }, { status: 401 });

  const { data: client, error: keyErr } = await supabase
    .from("clients")
    .select("id")
    .eq("ingest_key", key)
    .maybeSingle();
  if (keyErr || !client) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    automationId?: string;
    status?: string;
    minutesSaved?: number | string;
    dollarsSaved?: number | string;
    detail?: string;
  };

  const { error } = await supabase.from("runs").insert({
    client_id: client.id,
    automation_id: body.automationId ?? null,
    status: body.status === "failed" ? "failed" : "success",
    minutes_saved: Number(body.minutesSaved) || 0,
    dollars_saved: Number(body.dollarsSaved) || 0,
    detail: typeof body.detail === "string" ? body.detail.slice(0, 500) : null,
  });
  if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
