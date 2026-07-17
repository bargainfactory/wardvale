import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { startTrace } from "@/lib/trace";
import { reportError } from "@/lib/report";
import { getServiceClient } from "@/lib/supabase-server";
import { clientScope } from "@/lib/tenant";
import { loadContext } from "@/lib/context";
import { sendApprovalNotification } from "@/lib/email";
import { runLeadQualification } from "@/lib/runtime";
import { modelConfigured } from "@/lib/model";
import { runConcierge, defaultDeps, classifyIntent, defaultOrderSideQuest, stepsToApprovals, stepsToTouches, isImmediate, type ConciergeDeps, type Lead, type Step } from "@/lib/orchestrator";

/**
 * New-Lead Concierge workflow (Phase 3 · slices 1-2). A supervisor routes a lead
 * across sub-agents — qualify → outreach + follow-up, with a parallel order
 * side-quest — merges the steps into typed state, and (when the caller is a known
 * client via ingest key) PERSISTS them to the approval queue so the existing
 * decide / policy / judge / learning-loop machinery runs on them unchanged.
 *
 * Sub-agents: with OPENAI_API_KEY set, qualification + drafting use the real LLM
 * lead-qualification agent (injected via the DI seam); otherwise the keyless
 * heuristic defaults. Traced with a run_id so the U1 trajectory judge scores it.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`concierge:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const runId = globalThis.crypto.randomUUID();
  const trace = startTrace("workflow.concierge");
  trace.flag("run_id", runId);
  try {
    const body = (await req.json().catch(() => ({}))) as { lead?: Lead; ingest_key?: string };
    const lead = body.lead ?? {};
    trace.setInput(JSON.stringify(lead).slice(0, 2000));

    // Resolve the client (optional): if a valid ingest key is supplied, persist;
    // otherwise run statelessly (demo mode) and just return the proposed steps.
    const supabase = getServiceClient();
    const ingestKey = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || body.ingest_key;
    let clientId: string | null = null;
    let clientEmail: string | null = null;
    if (supabase && ingestKey) {
      const { data: client } = await supabase.from("clients").select("id, email").eq("ingest_key", ingestKey).maybeSingle();
      const c = client as { id: string; email: string | null } | null;
      clientId = c?.id ?? null;
      clientEmail = c?.email ?? null;
    }
    const context = clientId ? await loadContext(clientId) : "";

    // Parallel side-quest sub-agent: routes review vs AR by order state (slice 3).
    const orderSideQuest = async (l: Lead): Promise<Step[]> => defaultOrderSideQuest(l);

    // Wire the real LLM lead-qualification sub-agent when configured; one cached
    // call serves both the qualify and draft nodes. Falls back to heuristics.
    let cached: Promise<Awaited<ReturnType<typeof runLeadQualification>>> | undefined;
    const callLeadAgent = (l: Lead) =>
      (cached ??= runLeadQualification(
        [{ name: l.name, email: l.email, phone: l.phone, source: l.source, message: l.message }],
        trace,
        context
      ));
    const deps: ConciergeDeps = modelConfigured()
      ? {
          qualify: async (l) => {
            const acts = await callLeadAgent(l);
            const s = (acts[0]?.summary ?? "").toLowerCase();
            const intent = s.startsWith("hot") ? "hot" : s.startsWith("warm") ? "warm" : s.startsWith("cold") ? "cold" : classifyIntent(l).intent;
            return { intent, reason: acts[0]?.summary ?? "" };
          },
          draftOutreach: async (l, intent) => {
            const acts = await callLeadAgent(l);
            return { summary: acts[0]?.summary ?? `${intent} lead`, draft: acts[0]?.draft ?? "" };
          },
          orderSideQuest,
        }
      : { ...defaultDeps, orderSideQuest };

    const state = await runConcierge(lead, deps);
    trace.flag("intent", state.intent);

    // Persist to the approval queue (idempotent) when we have a client.
    let persisted = 0;
    let scheduled = 0;
    if (clientId && supabase && state.steps.length) {
      // Immediate steps → approval queue now; future touches → scheduled_touches
      // (fired later by /api/cron/touches). Both idempotent.
      const rows = stepsToApprovals(clientId, lead, state.steps.filter(isImmediate), runId);
      if (rows.length) {
        const { data: inserted } = await clientScope(supabase, clientId)
          .upsert("approvals", rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
          .select("id");
        persisted = (inserted as { id: string }[] | null)?.length ?? 0;
      }
      const touches = stepsToTouches(clientId, lead, state.steps, runId, Date.now());
      if (touches.length) {
        const { data: st } = await supabase
          .from("scheduled_touches")
          .upsert(touches, { onConflict: "dedupe_key", ignoreDuplicates: true })
          .select("id");
        scheduled = (st as { id: string }[] | null)?.length ?? 0;
      }
      if (persisted && clientEmail) await sendApprovalNotification(clientEmail, persisted, "New-Lead Concierge");
    }

    trace.mark("orchestrated", { steps: state.steps.length, version: state.version, persisted });
    trace.setOutput(JSON.stringify(state.steps).slice(0, 4000));
    await trace.end();

    return NextResponse.json({
      ok: true,
      run_id: runId,
      intent: state.intent,
      reason: state.reason,
      version: state.version,
      steps: state.steps,
      persisted,
      scheduled,
      log: state.log,
    });
  } catch (err) {
    reportError(err, { source: "workflow.concierge" });
    trace.setStatus("error");
    await trace.end();
    return NextResponse.json({ error: "concierge_failed" }, { status: 500 });
  }
}
