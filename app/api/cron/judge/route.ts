import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { reportError } from "@/lib/report";
import { runPool } from "@/lib/scheduler";
import { componentChecks, trajectoryChecks, judgeDecision, shouldJudge, type Decision, type TraceSpan } from "@/lib/judge";
import { promptVersion } from "@/lib/prompts";
import { loadContext } from "@/lib/context";

// Judge harvester (roadmap U1). Runs off the hot path on a cadence: it pulls
// recently-queued agent decisions, runs the cheap deterministic component checks
// on ALL of them and the expensive LLM rubric on a SAMPLE (JUDGE_SAMPLE_RATE),
// and writes one judgement per decision (keyed to prompt_version). A unique index
// on approval_id makes re-runs idempotent. Authenticated with CRON_SECRET.

export const maxDuration = 60; // runtime-tier function config (G5)

const MAX_PER_RUN = Number(process.env.JUDGE_MAX_PER_RUN) || 100;
const CONCURRENCY = Number(process.env.JUDGE_CONCURRENCY) || 4;
const WINDOW_MS = 24 * 60 * 60_000;

function sampleRate(): number {
  const r = Number(process.env.JUDGE_SAMPLE_RATE);
  if (!Number.isFinite(r)) return 1;
  return Math.min(1, Math.max(0, r));
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}

type ApprovalRow = {
  id: string;
  client_id: string;
  agent: string | null;
  action: string;
  summary: string | null;
  payload: { draft?: string; source?: string; to?: string; kind?: string; run_id?: string } | null;
};

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
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { data: recent } = await supabase
      .from("approvals")
      .select("id, client_id, agent, action, summary, payload")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_PER_RUN);
    const approvals = (recent ?? []) as ApprovalRow[];

    // Skip decisions we've already judged (the unique index is the hard backstop).
    const { data: done } = await supabase
      .from("judgements")
      .select("approval_id")
      .in("approval_id", approvals.map((a) => a.id));
    const judged = new Set(((done ?? []) as { approval_id: string }[]).map((d) => d.approval_id));
    const todo = approvals.filter((a) => !judged.has(a.id));

    const rate = sampleRate();
    const contextCache = new Map<string, string>();
    const loadCtx = async (clientId: string): Promise<string> => {
      if (!contextCache.has(clientId)) contextCache.set(clientId, await loadContext(clientId));
      return contextCache.get(clientId)!;
    };

    let llmJudged = 0;
    const results = await runPool(
      todo,
      async (a) => {
        const payload = a.payload ?? {};
        const decision: Decision = {
          agent: a.agent,
          action: a.action,
          summary: a.summary,
          draft: payload.draft,
          source: payload.source,
          to: payload.to,
          needsApproval: true, // it's in the approval queue
        };
        const comp = componentChecks(decision, { inputText: payload.source });
        let checks = comp.checks;
        let passed = comp.passed;
        let failed = comp.failed;
        if (payload.run_id) {
          // Trajectory judge (U1): pull the linked trace and score the full cycle.
          const { data: tr } = await supabase
            .from("traces")
            .select("spans, flags, status")
            .eq("flags->>run_id", payload.run_id)
            .limit(1)
            .maybeSingle();
          if (tr) {
            const traj = trajectoryChecks(
              (tr.spans as TraceSpan[]) ?? [],
              (tr.flags as Record<string, unknown>) ?? {},
              String(tr.status ?? "ok")
            );
            checks = [...checks, ...traj];
            const tf = traj.filter((c) => !c.pass).length;
            passed += traj.length - tf;
            failed += tf;
          }
        }

        let verdict: string | null = null;
        let overall: number | null = null;
        let scores: Record<string, number> | null = null;
        let reasoning: string | null = null;
        let model: string | null = null;
        if (shouldJudge(Math.random(), rate)) {
          const j = await judgeDecision({
            agent: a.agent,
            action: a.action,
            source: payload.source,
            draft: payload.draft,
            businessContext: await loadCtx(a.client_id),
          });
          if (j) {
            verdict = j.verdict;
            overall = j.overall;
            scores = j.scores;
            reasoning = j.reasoning;
            model = j.model ?? null;
            llmJudged++;
          }
        }

        const { error } = await supabase.from("judgements").upsert(
          {
            approval_id: a.id,
            client_id: a.client_id,
            agent: a.agent,
            kind: payload.kind ?? null,
            prompt_version: promptVersion(payload.kind),
            component_passed: passed,
            component_failed: failed,
            checks,
            verdict,
            overall,
            scores,
            reasoning,
            model,
          },
          { onConflict: "approval_id", ignoreDuplicates: true }
        );
        return !error;
      },
      { concurrency: CONCURRENCY, retries: 1 }
    );

    const judgedCount = results.filter((r) => r.ok).length;
    return NextResponse.json({
      ok: true,
      candidates: approvals.length,
      judged: judgedCount,
      llmJudged,
      skippedAlreadyJudged: approvals.length - todo.length,
    });
  } catch (err) {
    reportError(err, { source: "judge.cron" });
    return NextResponse.json({ error: "judge_failed" }, { status: 500 });
  }
}
