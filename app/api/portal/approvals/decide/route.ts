import { NextResponse } from "next/server";
import { createServerSupabase, getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { sendAgentEmail } from "@/lib/email";
import { sendSmsForClient } from "@/lib/integrations";
import { recordOutcome } from "@/lib/outcomes";
import { recordFeedback } from "@/lib/feedback";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { startTrace } from "@/lib/trace";
import { decryptSecret } from "@/lib/crypto";
import { mcpCallTool, httpCallTool, ToolClientError } from "@/lib/mcp-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MCPSchema } from "@/lib/mcp";

// node:https/dns via the guarded mcp-client → Node runtime.
export const runtime = "nodejs";

type ApprovalRow = {
  id: string;
  client_id: string;
  agent: string | null;
  action: string;
  summary: string | null;
  payload: {
    draft?: string;
    source?: string;
    to?: string;
    value?: number;
    kind?: string;
    tool_id?: string;
    tool_name?: string;
    args?: Record<string, unknown>;
  } | null;
};

/**
 * Approve or reject a queued agent action. RLS (approvals_self_update) ensures a
 * user can only decide their own client's approvals. On approve, the action is
 * EXECUTED (email.send → the drafted reply is actually sent) with tool-execution
 * trace spans; the decision + execution are recorded to the governance audit.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`decide:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, decision, editedDraft } = (await req.json().catch(() => ({}))) as {
    id?: string;
    decision?: string;
    editedDraft?: string;
  };
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
  // The owner may tweak the draft before approving — that edit is the strongest
  // "good" signal for the learning loop, and is what actually gets sent.
  const edited = typeof editedDraft === "string" && editedDraft.trim().length > 0;
  if (decision === "approved" && (approval.action === "email.send" || approval.action === "sms.send")) {
    const to = approval.payload?.to;
    const draft = edited ? editedDraft!.trim() : approval.payload?.draft;
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

  // BYOT: execute an approved tool.call through the guarded client. Terminal —
  // the result is recorded for the owner and NEVER fed back to the model.
  if (decision === "approved" && approval.action === "tool.call" && svc) {
    executed = await executeToolCall(svc, approval);
  }

  if (svc) {
    await svc.from("agent_audit").insert({
      client_id: approval.client_id,
      actor: email,
      action: `approval.${decision}`,
      detail: approval.summary ?? approval.action,
    });

    // Learning loop: capture the decision as a per-client style signal. An
    // approved/edited draft teaches the agent what "good" looks like; a rejected
    // one is a soft negative.
    await recordFeedback(svc, {
      clientId: approval.client_id,
      agentKey: approval.payload?.kind ?? null,
      kind: decision === "rejected" ? "rejected" : edited ? "edited" : "approved",
      sample: (edited ? editedDraft!.trim() : approval.payload?.draft) ?? null,
      approvalId: approval.id, // lets the learning loop join judge scores (U5)
    });
  }

  return NextResponse.json({ ok: true, status: decision, executed });
}

async function logAudit(svc: SupabaseClient, clientId: string, action: string, detail: string) {
  await svc.from("agent_audit").insert({ client_id: clientId, actor: "runtime", action, detail: detail.slice(0, 1500) });
}

/**
 * Execute an approved BYOT tool call, scoped to the approval's own client, with
 * per-client burst rate + a durable daily cap, a decrypted-just-in-time bearer,
 * and args validated against the cached schema. The output is fenced by the
 * client and stored (RLS-protected) for the owner — never returned to the model,
 * never console-logged, and the token/args never enter an audit string.
 */
async function executeToolCall(svc: SupabaseClient, approval: ApprovalRow): Promise<boolean> {
  const clientId = approval.client_id;
  const toolId = approval.payload?.tool_id;
  const toolName = approval.payload?.tool_name;
  const args = (approval.payload?.args ?? {}) as Record<string, unknown>;
  if (!toolId || !toolName) return false;

  // Per-client burst rate (first per-client rate key in the codebase).
  const rl = await rateLimit(`tool:${clientId}`, 20, 60_000);
  if (!rl.ok) {
    await logAudit(svc, clientId, "tool.call.blocked_cap", `rate limit: ${toolName}`);
    return false;
  }

  const { data: tool } = await svc
    .from("client_tools")
    .select("id, kind, endpoint, auth_scheme, enabled, status, tools_cache, daily_call_cap")
    .eq("client_id", clientId)
    .eq("id", toolId)
    .maybeSingle();
  const tl = tool as {
    id: string;
    kind: "mcp" | "http";
    endpoint: string;
    auth_scheme: string;
    enabled: boolean;
    status: string;
    tools_cache: { name?: string; inputSchema?: MCPSchema }[] | null;
    daily_call_cap: number | null;
  } | null;
  if (!tl || !tl.enabled || tl.status !== "ok") {
    await logAudit(svc, clientId, "tool.call.failed", `unavailable: ${toolName}`);
    return false;
  }

  // Durable daily cap — count real executions today (not per-instance buckets).
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await svc
    .from("agent_audit")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("action", "tool.call.executed")
    .gte("created_at", since.toISOString());
  if ((count ?? 0) >= (tl.daily_call_cap ?? 100)) {
    await logAudit(svc, clientId, "tool.call.blocked_cap", `daily cap reached: ${toolName}`);
    return false;
  }

  // Decrypt the bearer just in time (only for bearer-scheme tools).
  let token: string | null = null;
  if (tl.auth_scheme === "bearer") {
    const { data: sec } = await svc.from("client_tool_secrets").select("access_token").eq("tool_id", tl.id).maybeSingle();
    const enc = (sec as { access_token?: string } | null)?.access_token;
    token = enc ? decryptSecret(enc) : null;
  }

  const schema = (tl.tools_cache ?? []).find((c) => c?.name === toolName)?.inputSchema;

  try {
    const res =
      tl.kind === "mcp"
        ? await mcpCallTool(tl.endpoint, token, toolName, args, schema)
        : await httpCallTool(tl.endpoint, token, args, schema);
    await logAudit(svc, clientId, "tool.call.executed", `${toolName}${res.flagged ? " ⚠ flagged output" : ""}`);
    // The fenced result, stored for the owner to read in their audit trail.
    await logAudit(svc, clientId, "tool.call.result", res.text);
    return true;
  } catch (e) {
    await logAudit(svc, clientId, "tool.call.failed", `${toolName}: ${e instanceof ToolClientError ? e.code : "error"}`);
    return false;
  }
}
