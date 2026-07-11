import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { startTrace } from "@/lib/trace";
import { runInboxTriage, runArFollowup, type InboxMessage, type Invoice, type ProposedAction } from "@/lib/runtime";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * The first real end-to-end agent cycle: read messages (tool) → decide one
 * action each via a guarded, traced LLM step → queue outbound actions
 * (email.send / escalate) for human approval instead of executing them.
 *
 * Auth: pass a client `ingest_key` (Bearer or x-api-key) to persist approvals +
 * audit for that client. Without one it runs statelessly and just returns the
 * proposed actions (safe demo).
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`agentrun:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }

  const trace = startTrace("agent.run");
  try {
    const body = (await req.json().catch(() => ({}))) as {
      agent?: string;
      messages?: InboxMessage[];
      invoices?: Invoice[];
    };

    let actions: ProposedAction[];
    if (body.agent === "ar-followup") {
      const invoices = Array.isArray(body.invoices) ? body.invoices : [];
      trace.setInput(invoices.map((v) => v?.number ?? "").join("; "));
      actions = await runArFollowup(invoices, trace);
    } else {
      const messages = Array.isArray(body.messages) ? body.messages : [];
      trace.setInput(messages.map((m) => m?.subject ?? "").join("; "));
      actions = await runInboxTriage(messages, trace);
    }
    const needApproval = actions.filter((a) => a.needsApproval);
    trace.mark("decided", { total: actions.length, queued: needApproval.length });
    trace.setOutput(JSON.stringify(actions).slice(0, 4000));

    // If a client is identified, queue the gated actions for approval + audit.
    let queued = 0;
    const key =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
      req.headers.get("x-api-key")?.trim() ||
      "";
    if (key) {
      const supabase = getServiceClient();
      if (supabase) {
        const { data: client } = await supabase.from("clients").select("id").eq("ingest_key", key).maybeSingle();
        if (client) {
          const rows = needApproval.map((a) => ({
            client_id: client.id,
            agent: a.agent,
            action: a.action,
            summary: a.summary,
            payload: { draft: a.draft ?? null, source: a.source, to: a.to ?? null },
          }));
          if (rows.length) {
            await supabase.from("approvals").insert(rows);
            queued = rows.length;
          }
          await supabase.from("agent_audit").insert({
            client_id: client.id,
            actor: "runtime",
            action: "agent.run",
            detail: `Inbox triage: ${actions.length} decided, ${queued} queued for approval`,
          });
          trace.flag("persisted", true);
        }
      }
    }

    await trace.end();
    return NextResponse.json({ ok: true, decided: actions.length, queued, actions });
  } catch {
    trace.setStatus("error");
    await trace.end();
    return NextResponse.json({ error: "run_failed" }, { status: 500 });
  }
}
