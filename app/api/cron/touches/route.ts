import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { reportError } from "@/lib/report";
import { runPool } from "@/lib/scheduler";
import { dueTouches, touchToApproval, type TouchRow } from "@/lib/orchestrator";

/**
 * Fire due scheduled touches (Phase 3 · U2 slice 4). Promotes pending concierge
 * touches whose fire_at has arrived into the approval queue (idempotent), then
 * marks them fired. Authenticated with CRON_SECRET; safe/no-op without Supabase.
 */
export const maxDuration = 60; // runtime-tier function config (G5)

const MAX_PER_RUN = Number(process.env.TOUCHES_MAX_PER_RUN) || 200;

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

  try {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("scheduled_touches")
      .select("id, client_id, run_id, kind, agent, summary, draft, recipient, learn_kind, dedupe_key, fire_at, status")
      .eq("status", "pending")
      .lte("fire_at", nowIso)
      .order("fire_at", { ascending: true })
      .limit(MAX_PER_RUN);
    const due = dueTouches((data ?? []) as (TouchRow & { id: string; status: string })[], nowIso);

    const results = await runPool(
      due,
      async (t) => {
        const { error } = await supabase
          .from("approvals")
          .upsert({ client_id: t.client_id, ...touchToApproval(t) }, { onConflict: "dedupe_key", ignoreDuplicates: true });
        if (error) return false;
        await supabase.from("scheduled_touches").update({ status: "fired" }).eq("id", t.id);
        return true;
      },
      { concurrency: 6, retries: 1 }
    );

    const fired = results.filter((r) => r.ok).length;
    if (fired < due.length) reportError(`touches: ${due.length - fired} failed to fire`, { source: "cron.touches" });
    return NextResponse.json({ ok: true, due: due.length, fired });
  } catch (err) {
    reportError(err, { source: "cron.touches" });
    return NextResponse.json({ error: "touches_failed" }, { status: 500 });
  }
}
