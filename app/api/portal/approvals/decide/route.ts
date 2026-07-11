import { NextResponse } from "next/server";
import { createServerSupabase, getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { sendAgentEmail } from "@/lib/email";
import { sendSmsForClient } from "@/lib/integrations";
import { recordOutcome } from "@/lib/outcomes";
import { startTrace } from "@/lib/trace";

type ApprovalRow = {
  id: string;
  client_id: string;
  agent: string | null;
  action: string;
  summary: string | null;
  payload: { draft?: string; source?: string; to?: string; value?: number; kind?: string } | null;
};

/**
 * Approve or reject a queued agent action. RLS (approvals_self_update) ensures a
 * user can only decide their own client's approvals. On approve, the action is
 * EXECUTED (email.send → the drafted reply is actually sent) with tool-execution
 * trace spans; the decision + execution are recorded to the governance audit.
 */
export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, decision } = (await req.json().catch(() => ({}))) as { id?: string; decision?: string };
  if (!id || (decision !== "approved" && decision !== "rejected")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("approvals")
    .update({ status: decision, decided_by: email, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, client_id, agent, action, summary, payload")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const approval = data as ApprovalRow;
  const svc = getServiceClient();

  // Execute the action on approve (email.send via Resend, sms.send via the
  // client's connected Twilio), fully traced.
  let executed: boolean | undefined;
  if (decision === "approved" && (approval.action === "email.send" || approval.action === "sms.send")) {
    const to = approval.payload?.to;
    const draft = approval.payload?.draft;
    const subject = approval.payload?.source ?? "your message";
    const trace = startTrace("action.execute");
    trace.mark("approval.approved", { action: approval.action });
    if (to && draft) {
      trace.setOutput(draft);
      if (approval.action === "email.send") {
        trace.mark("tool.email.send.start", { to });
        executed = await sendAgentEmail(to, subject, draft);
        trace.mark("tool.email.send.end", { sent: executed });
        trace.flag("tool", "email.send");
      } else {
        trace.mark("tool.sms.send.start", { to });
        executed = svc ? await sendSmsForClient(svc, approval.client_id, to, draft) : false;
        trace.mark("tool.sms.send.end", { sent: executed });
        trace.flag("tool", "sms.send");
      }
      trace.setStatus(executed ? "ok" : "send_failed");
      if (svc) {
        await svc.from("agent_audit").insert({
          client_id: approval.client_id,
          actor: "runtime",
          action: executed ? "action.executed" : "action.failed",
          detail: `${approval.action} → ${to} (re: ${subject})`,
        });
        // A sent action with money at stake becomes pending ROI pipeline.
        if (executed) {
          await recordOutcome(svc, {
            clientId: approval.client_id,
            approvalId: approval.id,
            agent: approval.agent,
            action: approval.action,
            kind: approval.payload?.kind ?? null,
            value: approval.payload?.value ?? null,
            detail: approval.summary,
            ref: approval.payload?.source ?? null,
          });
        }
      }
    } else {
      trace.setStatus("skipped_no_recipient");
    }
    await trace.end();
  }

  if (svc) {
    await svc.from("agent_audit").insert({
      client_id: approval.client_id,
      actor: email,
      action: `approval.${decision}`,
      detail: approval.summary ?? approval.action,
    });
  }

  return NextResponse.json({ ok: true, status: decision, executed });
}
