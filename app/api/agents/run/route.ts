import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { startTrace } from "@/lib/trace";
import {
  runInboxTriage,
  runArFollowup,
  runCartRecovery,
  runReviewRequest,
  runLeadQualification,
  type InboxMessage,
  type Invoice,
  type Cart,
  type ReviewTarget,
  type Lead,
  type ProposedAction,
} from "@/lib/runtime";
import { getServiceClient } from "@/lib/supabase-server";
import { loadContext } from "@/lib/context";
import { loadExemplars } from "@/lib/feedback";
import { sendApprovalNotification, sendAgentEmail } from "@/lib/email";
import { sendSmsForClient } from "@/lib/integrations";
import { recordOutcome } from "@/lib/outcomes";
import { loadPolicy, spentToday, policyBlocks } from "@/lib/policy";
import { firstTime, idemKey } from "@/lib/idempotency";
import { agentName } from "@/lib/agents-catalog";
import {
  pullOverdueInvoices,
  pullAbandonedCheckouts,
  pullRecentOrders,
  pullOpenTickets,
  pullNewLeads,
} from "@/lib/integrations";

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
      carts?: Cart[];
      targets?: ReviewTarget[];
      leads?: Lead[];
    };

    // A client's ingest key both scopes persistence and unlocks live data pulls
    // from that client's connected tools (e.g. QuickBooks).
    const key =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
      req.headers.get("x-api-key")?.trim() ||
      "";

    // Load the client's business context once so every agent drafts in their
    // voice, using their real hours/services/pricing — no per-client prompt code.
    let context: string | undefined;
    if (key) {
      const svc = getServiceClient();
      if (svc) {
        const { data: c } = await svc.from("clients").select("id").eq("ingest_key", key).maybeSingle();
        if (c) {
          // Business context + the owner's own approved examples (learning loop).
          const parts = [await loadContext(c.id)];
          if (body.agent) parts.push(await loadExemplars(c.id, body.agent));
          context = parts.filter(Boolean).join("\n\n") || undefined;
        }
      }
    }

    // Each agent runs on data passed in the body, or — when a known client's
    // ingest key is present and no data is supplied — on LIVE data pulled from
    // that client's connected tool. Outbound actions are queued for approval.
    let actions: ProposedAction[];
    switch (body.agent) {
      case "ar-followup": {
        let invoices = Array.isArray(body.invoices) ? body.invoices : [];
        if (invoices.length === 0 && key) {
          const pulled = await pullOverdueInvoices(key, trace);
          if (pulled) {
            invoices = pulled.invoices;
            trace.flag("source", "quickbooks");
          }
        }
        trace.setInput(invoices.map((v) => v?.number ?? "").join("; "));
        actions = await runArFollowup(invoices, trace, context);
        break;
      }
      case "cart-recovery": {
        let carts = Array.isArray(body.carts) ? body.carts : [];
        if (carts.length === 0 && key) {
          const pulled = await pullAbandonedCheckouts(key, trace);
          if (pulled) {
            carts = pulled.carts;
            trace.flag("source", "shopify");
          }
        }
        trace.setInput(carts.map((c) => c?.customer ?? "").join("; "));
        actions = await runCartRecovery(carts, trace, context);
        break;
      }
      case "review-request": {
        let targets = Array.isArray(body.targets) ? body.targets : [];
        if (targets.length === 0 && key) {
          const pulled = await pullRecentOrders(key, trace);
          if (pulled) {
            targets = pulled.targets;
            trace.flag("source", "shopify");
          }
        }
        trace.setInput(targets.map((t) => t?.customer ?? "").join("; "));
        actions = await runReviewRequest(targets, trace, context);
        break;
      }
      case "lead-qualification": {
        let leads = Array.isArray(body.leads) ? body.leads : [];
        if (leads.length === 0 && key) {
          const pulled = await pullNewLeads(key, trace);
          if (pulled) {
            leads = pulled.leads;
            trace.flag("source", "hubspot");
          }
        }
        trace.setInput(leads.map((l) => l?.name ?? "").join("; "));
        actions = await runLeadQualification(leads, trace, context);
        break;
      }
      case "support-triage": {
        let messages = Array.isArray(body.messages) ? body.messages : [];
        if (messages.length === 0 && key) {
          const pulled = await pullOpenTickets(key, trace);
          if (pulled) {
            messages = pulled.messages;
            trace.flag("source", "zendesk");
          }
        }
        trace.setInput(messages.map((m) => m?.subject ?? "").join("; "));
        actions = await runInboxTriage(messages, trace, context);
        break;
      }
      default: {
        const messages = Array.isArray(body.messages) ? body.messages : [];
        trace.setInput(messages.map((m) => m?.subject ?? "").join("; "));
        actions = await runInboxTriage(messages, trace, context);
      }
    }
    const needApproval = actions.filter((a) => a.needsApproval);
    trace.mark("decided", { total: actions.length, queued: needApproval.length });
    trace.setOutput(JSON.stringify(actions).slice(0, 4000));

    // If a client is identified, queue the gated actions for approval + audit,
    // and return the inserted rows (with real ids) so the portal can render them
    // in place without a reload.
    let queued = 0;
    let autoSent = 0;
    let approvals: { id: string; agent: string; action: string; summary: string; createdAt: string }[] = [];
    if (key) {
      const supabase = getServiceClient();
      if (supabase) {
        const { data: client } = await supabase.from("clients").select("id, email").eq("ingest_key", key).maybeSingle();
        if (client) {
          // If this agent is set to auto-send, its actions execute immediately;
          // otherwise every outbound action is queued for approval (safe default).
          let autoSend = false;
          if (body.agent) {
            const { data: cfg } = await supabase
              .from("agent_config")
              .select("auto_send")
              .eq("client_id", client.id)
              .eq("agent_key", body.agent)
              .maybeSingle();
            autoSend = Boolean(cfg?.auto_send);
          }

          // Governance: even when auto-send is on, a policy (spend cap, per-action
          // threshold, domain allowlist) can force an action back to approval.
          const policy = await loadPolicy(supabase, client.id);
          let spentSoFar = await spentToday(supabase, client.id);

          const toQueue: { client_id: string; agent: string; action: string; summary: string; payload: Record<string, unknown> }[] = [];
          for (const a of needApproval) {
            const canAuto =
              autoSend && !policyBlocks(policy, a, spentSoFar) && (a.action === "email.send" || a.action === "sms.send");
            if (canAuto && a.to && a.draft) {
              const ok =
                a.action === "sms.send"
                  ? await sendSmsForClient(supabase, client.id, a.to, a.draft)
                  : await sendAgentEmail(a.to, a.source, a.draft);
              if (ok) {
                autoSent += 1;
                spentSoFar += Number(a.value) || 0; // count against the daily cap
                // A sent action with money at stake becomes pending ROI pipeline.
                await recordOutcome(supabase, {
                  clientId: client.id,
                  agent: a.agent,
                  action: a.action,
                  kind: body.agent,
                  value: a.value,
                  detail: a.summary,
                  ref: a.source,
                });
              }
              await supabase.from("agent_audit").insert({
                client_id: client.id,
                actor: "runtime",
                action: ok ? "action.executed" : "action.failed",
                detail: `${a.action} → ${a.to} (auto-send)`,
              });
            } else {
              toQueue.push({
                client_id: client.id,
                agent: a.agent,
                action: a.action,
                summary: a.summary,
                payload: { draft: a.draft ?? null, source: a.source, to: a.to ?? null, value: a.value ?? null, kind: body.agent ?? null },
              });
            }
          }

          if (toQueue.length) {
            const { data: inserted } = await supabase
              .from("approvals")
              .insert(toQueue)
              .select("id, agent, action, summary");
            approvals = ((inserted as { id: string; agent: string | null; action: string; summary: string | null }[] | null) ?? []).map(
              (a) => ({ id: a.id, agent: a.agent ?? "agent", action: a.action, summary: a.summary ?? "", createdAt: "just now" })
            );
            queued = approvals.length;
          }

          await supabase.from("agent_audit").insert({
            client_id: client.id,
            actor: "runtime",
            action: "agent.run",
            detail: `${body.agent ?? "inbox-triage"}: ${actions.length} decided, ${queued} queued, ${autoSent} auto-sent`,
          });
          trace.flag("persisted", true);

          // Notify the owner there are drafts to review — throttled to at most
          // one email per client per ~hour so the scheduler can't spam them.
          if (queued > 0 && client.email && firstTime(idemKey("notify", client.id), 55 * 60_000)) {
            await sendApprovalNotification(client.email, queued, agentName(body.agent ?? "inbox-triage"));
          }
        }
      }
    }

    await trace.end();
    return NextResponse.json({ ok: true, decided: actions.length, queued, autoSent, actions, approvals });
  } catch {
    trace.setStatus("error");
    await trace.end();
    return NextResponse.json({ error: "run_failed" }, { status: 500 });
  }
}
