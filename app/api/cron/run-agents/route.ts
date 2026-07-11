import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { scheduleAllowed, type Schedule } from "@/lib/agents-catalog";

// Autonomous scheduler. Vercel Cron (or any authenticated caller) hits this on a
// cadence; it finds every enabled, scheduled agent that's DUE for an active
// client and runs one cycle — pulling live data and queuing approval-gated
// actions — then stamps last_run_at. Set CRON_SECRET and send it as a Bearer
// token (Vercel Cron does this automatically from the dashboard-configured
// secret) or as ?key=.

const DUE_MS: Record<string, number> = { hourly: 60 * 60_000, daily: 24 * 60 * 60_000 };
const MAX_PER_RUN = 50; // safety cap so one invocation can't fan out unbounded

type ConfigRow = { id: string; client_id: string; agent_key: string; schedule: Schedule; last_run_at: string | null };
type ClientRow = { id: string; ingest_key: string; plan: string };

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const url = new URL(req.url);
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || url.searchParams.get("key") || "";
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  // Active clients → { id: {ingest_key, plan} }.
  const { data: clients } = await supabase.from("clients").select("id, ingest_key, plan").eq("status", "active");
  const clientMap = new Map<string, ClientRow>();
  for (const c of (clients ?? []) as ClientRow[]) clientMap.set(c.id, c);

  // Enabled, scheduled configs.
  const { data: configs } = await supabase
    .from("agent_config")
    .select("id, client_id, agent_key, schedule, last_run_at")
    .eq("enabled", true)
    .in("schedule", ["hourly", "daily"]);

  const now = Date.now();
  const due = ((configs ?? []) as ConfigRow[]).filter((c) => {
    const client = clientMap.get(c.client_id);
    if (!client) return false; // inactive/suspended
    if (!scheduleAllowed(client.plan, c.schedule)) return false; // plan entitlement
    const last = c.last_run_at ? new Date(c.last_run_at).getTime() : 0;
    return now - last >= (DUE_MS[c.schedule] ?? Infinity);
  });

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  let ran = 0;
  const results: { agent: string; ok: boolean; queued?: number }[] = [];
  for (const c of due.slice(0, MAX_PER_RUN)) {
    const client = clientMap.get(c.client_id)!;
    try {
      const res = await fetch(`${origin}/api/agents/run`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${client.ingest_key}` },
        body: JSON.stringify({ agent: c.agent_key }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { queued?: number };
      results.push({ agent: c.agent_key, ok: res.ok, queued: data.queued });
      ran += 1;
    } catch {
      results.push({ agent: c.agent_key, ok: false });
    }
    // Stamp last_run_at regardless, so a failing agent doesn't hot-loop.
    await supabase.from("agent_config").update({ last_run_at: new Date(now).toISOString() }).eq("id", c.id);
  }

  return NextResponse.json({ ok: true, candidates: due.length, ran, results });
}
