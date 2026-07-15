import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { startTrace } from "@/lib/trace";
import { reportError } from "@/lib/report";
import { runConcierge, defaultDeps, type Lead, type Step } from "@/lib/orchestrator";

/**
 * New-Lead Concierge workflow (Phase 3 · slice 1). A supervisor routes a lead
 * across sub-agents — qualify → outreach + follow-up, with a parallel order
 * side-quest — and returns the merged, human-gated steps. Runs keyless via the
 * heuristic default sub-agents; inject the LLM lead-qualification/drafting agents
 * here (guarded by OPENAI_API_KEY) to upgrade quality without changing the graph.
 * Traced with a run_id so the U1 trajectory judge can score orchestrated runs.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`concierge:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const runId = globalThis.crypto.randomUUID();
  const trace = startTrace("workflow.concierge");
  trace.flag("run_id", runId);
  try {
    const body = (await req.json().catch(() => ({}))) as { lead?: Lead };
    const lead = body.lead ?? {};
    trace.setInput(JSON.stringify(lead).slice(0, 2000));

    // Parallel side-quest sub-agent: if the lead references an existing order,
    // ask for a review. (In a fuller build this would route to review vs AR.)
    const orderSideQuest = async (l: Lead): Promise<Step[]> => [
      {
        kind: "review",
        action: "email.send",
        summary: `Ask ${l.name || "the customer"} for a review of their recent order`,
        draft: `Hi ${l.name || "there"} — hope you're loving your recent order! Would you mind leaving a quick review? It really helps.`,
        needsApproval: true,
        agent: "concierge:review",
      },
    ];

    const state = await runConcierge(lead, { ...defaultDeps, orderSideQuest });
    trace.flag("intent", state.intent);
    trace.mark("orchestrated", { steps: state.steps.length, version: state.version });
    trace.setOutput(JSON.stringify(state.steps).slice(0, 4000));
    await trace.end();

    return NextResponse.json({
      ok: true,
      run_id: runId,
      intent: state.intent,
      reason: state.reason,
      version: state.version,
      steps: state.steps,
      log: state.log,
    });
  } catch (err) {
    reportError(err, { source: "workflow.concierge" });
    trace.setStatus("error");
    await trace.end();
    return NextResponse.json({ error: "concierge_failed" }, { status: 500 });
  }
}
