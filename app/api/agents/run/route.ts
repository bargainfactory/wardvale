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
        actions = await runArFollowup(invoices, trace);
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
        actions = await runCartRecovery(carts, trace);
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
        actions = await runReviewRequest(targets, trace);
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
        actions = await runLeadQualification(leads, trace);
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
        actions = await runInboxTriage(messages, trace);
        break;
      }
      default: {
        const messages = Array.isArray(body.messages) ? body.messages : [];
        trace.setInput(messages.map((m) => m?.subject ?? "").join("; "));
        actions = await runInboxTriage(messages, trace);
      }
    }
    const needApproval = actions.filter((a) => a.needsApproval);
    trace.mark("decided", { total: actions.length, queued: needApproval.length });
    trace.setOutput(JSON.stringify(actions).slice(0, 4000));

    // If a client is identified, queue the gated actions for approval + audit.
    let queued = 0;
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
