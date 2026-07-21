import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { reportError, reportWarning } from "@/lib/report";
import {
  dueJobs,
  dueCustomAutomations,
  runPool,
  qstashConfigured,
  publishToQStash,
  type ConfigRow,
  type ClientLite,
  type CustomAutomationRow,
} from "@/lib/scheduler";

// Autonomous scheduler (roadmap G4). Vercel Cron (or any authenticated caller)
// hits this on a cadence. It finds every enabled, scheduled agent that is DUE
// for an active + plan-entitled client — oldest-due first, so a backlog can't
// starve later clients — and dispatches one cycle each.
//
// Dispatch is DURABLE when QStash is configured (QSTASH_TOKEN): every job is
// published to QStash, which delivers it to /api/agents/run with the client's
// bearer and handles retry + dead-letter. Without QStash it falls back to a
// bounded-concurrency in-process runner with per-job retry — so one slow client
// no longer blocks the rest, and nothing is silently dropped (any overflow past
// SCHEDULER_MAX_INLINE is processed oldest-first next tick and is logged, not
// swallowed). Set CRON_SECRET and send it as a Bearer token or ?key=.

// Runtime-tier function config (roadmap G5): batch-processing crons get a longer
// limit and scale as their own serverless function, independent of page loads.
export const maxDuration = 60;

const CONCURRENCY = Number(process.env.SCHEDULER_CONCURRENCY) || 6;
const MAX_INLINE = Number(process.env.SCHEDULER_MAX_INLINE) || 100;

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
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || url.searchParams.get("key") || "";
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  try {
    const [{ data: clients }, { data: configs }, { data: customs }] = await Promise.all([
      supabase.from("clients").select("id, ingest_key, plan, timezone").eq("status", "active"),
      supabase
        .from("agent_config")
        .select("id, client_id, agent_key, schedule, last_run_at, run_hour, run_day")
        .eq("enabled", true)
        .in("schedule", ["hourly", "daily", "weekly"]),
      supabase
        .from("automations")
        .select("id, client_id, schedule, run_hour, run_day, last_run_at")
        .eq("kind", "custom")
        .eq("status", "active")
        .in("schedule", ["daily", "weekly"]),
    ]);

    const clientMap = new Map<string, ClientLite>();
    for (const c of (clients ?? []) as ClientLite[]) clientMap.set(c.id, c);

    const now = Date.now();
    const jobs = dueJobs((configs ?? []) as ConfigRow[], clientMap, now);
    const customJobs = dueCustomAutomations((customs ?? []) as CustomAutomationRow[], clientMap, now);

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
    const runUrl = `${origin}/api/agents/run`;
    const stamp = new Date(now).toISOString();
    const stampConfigs = (ids: string[]) =>
      ids.length ? supabase.from("agent_config").update({ last_run_at: stamp }).in("id", ids) : Promise.resolve();
    const stampCustoms = (ids: string[]) =>
      ids.length ? supabase.from("automations").update({ last_run_at: stamp }).in("id", ids) : Promise.resolve();

    // Custom automations dispatch first (small, hour-gated, Growth+ only) —
    // durable via QStash when configured, else inline with the same pool.
    if (customJobs.length) {
      const results = await runPool(
        customJobs,
        async (job) => {
          if (qstashConfigured()) return publishToQStash(runUrl, job.ingestKey, "custom-task", { automationId: job.automationId });
          const res = await fetch(runUrl, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${job.ingestKey}` },
            body: JSON.stringify({ agent: "custom-task", automationId: job.automationId }),
            cache: "no-store",
          });
          return res.ok;
        },
        { concurrency: CONCURRENCY, retries: 1 }
      );
      const okIds = results.filter((r) => r.ok).map((r) => r.item.automationId);
      const failedCustom = results.length - okIds.length;
      if (failedCustom) reportWarning(`scheduler: ${failedCustom} custom automations failed to dispatch`, { source: "scheduler", detail: { failedCustom } });
      // Stamp all attempted so a broken automation can't hot-loop.
      await stampCustoms(customJobs.map((j) => j.automationId));
    }

    // ── Durable path: hand every job to QStash (retry + DLQ handled there). ──
    if (qstashConfigured()) {
      const results = await runPool(jobs, (job) => publishToQStash(runUrl, job.ingestKey, job.agentKey), {
        concurrency: CONCURRENCY,
        retries: 1,
      });
      const enqueued = results.filter((r) => r.ok);
      const failed = results.length - enqueued.length;
      if (failed) reportWarning(`scheduler: ${failed} jobs failed to enqueue to QStash`, { source: "scheduler", detail: { failed } });
      await stampConfigs(enqueued.map((r) => r.item.configId));
      return NextResponse.json({ ok: true, mode: "qstash", due: jobs.length, enqueued: enqueued.length, failed });
    }

    // ── Fallback: bounded-concurrency in-process dispatch, oldest-first. ──
    const batch = jobs.slice(0, MAX_INLINE);
    const deferred = jobs.length - batch.length;
    if (deferred > 0)
      reportWarning(`scheduler: ${deferred} due jobs deferred to next tick (over SCHEDULER_MAX_INLINE=${MAX_INLINE}); oldest run first`, {
        source: "scheduler",
        detail: { deferred, cap: MAX_INLINE },
      });

    const results = await runPool(
      batch,
      async (job) => {
        const res = await fetch(runUrl, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${job.ingestKey}` },
          body: JSON.stringify({ agent: job.agentKey }),
          cache: "no-store",
        });
        return res.ok;
      },
      { concurrency: CONCURRENCY, retries: 2 }
    );

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;
    if (failed) reportWarning(`scheduler: ${failed} agent runs failed after retries`, { source: "scheduler", detail: { failed } });

    // Stamp everything we attempted (incl. failures) so a broken agent can't
    // hot-loop; runPool already retried transient failures inline.
    await stampConfigs(batch.map((j) => j.configId));

    return NextResponse.json({ ok: true, mode: "inline", due: jobs.length, ran: batch.length, succeeded, failed, deferred });
  } catch (err) {
    reportError(err, { source: "scheduler" });
    return NextResponse.json({ error: "scheduler_failed" }, { status: 500 });
  }
}
