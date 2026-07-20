import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { startTrace } from "@/lib/trace";
import {
  runInboxTriage,
  runArFollowup,
  runCartRecovery,
  runReviewRequest,
  runLeadQualification,
  runWinback,
  runQuoteFollowup,
  runHiringAssist,
  runReferralAsk,
  runNoshowShield,
  runReviewResponse,
  runShiftCover,
  runContentDrafter,
  runDocChaser,
  runDisputeFighter,
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
import { resolveOutcomes } from "@/lib/outcomes";
import { loadPolicy, spentToday, policyBlocks } from "@/lib/policy";
import { firstTime, idemKey } from "@/lib/idempotency";
import { dedupeKey } from "@/lib/dedupe";
import { reportError } from "@/lib/report";
import { promptVersion } from "@/lib/prompts";
import { agentName } from "@/lib/agents-catalog";
import {
  pullOverdueInvoices,
  pullAbandonedCheckouts,
  pullRecentOrders,
  pullOpenTickets,
  pullNewLeads,
  pullLapsedCustomers,
  pullOpenEstimates,
  pullUpcomingAppointments,
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

  const runId = globalThis.crypto.randomUUID();
  const trace = startTrace("agent.run");
  trace.flag("run_id", runId); // links this decision's trace to its queued approvals (U1 trajectory judge)
  try {
    const body = (await req.json().catch(() => ({}))) as {
      agent?: string;
      messages?: InboxMessage[];
      invoices?: Invoice[];
      carts?: Cart[];
      targets?: ReviewTarget[];
      leads?: Lead[];
      // Wave 2 lane payloads
      lapsed?: import("@/lib/runtime").LapsedCustomer[];
      quotes?: import("@/lib/runtime").OpenQuote[];
      applicants?: import("@/lib/runtime").Applicant[];
      moments?: import("@/lib/runtime").ReferralMoment[];
      appointments?: import("@/lib/runtime").AppointmentItem[];
      reviews?: import("@/lib/runtime").ReviewItem[];
      callout?: import("@/lib/runtime").CallOut;
      candidates?: import("@/lib/runtime").CoverCandidate[];
      requests?: import("@/lib/runtime").ContentRequest[];
      docs?: import("@/lib/runtime").MissingDocs[];
      disputes?: import("@/lib/runtime").DisputeItem[];
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
            // Any prior reminder whose invoice is no longer overdue → it got paid.
            const svc = getServiceClient();
            if (svc) {
              const won = await resolveOutcomes(svc, pulled.clientId, "ar-followup", invoices.map((v) => `Invoice ${v.number ?? ""}`));
              if (won) trace.flag("resolved", won);
            }
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
            // Any prior recovery whose cart is no longer abandoned → it converted.
            const svc = getServiceClient();
            if (svc) {
              const won = await resolveOutcomes(svc, pulled.clientId, "cart-recovery", carts.map((c) => `Cart ${c.customer || c.email || ""}`));
              if (won) trace.flag("resolved", won);
            }
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
      // ── Wave 2 lanes ──
      case "winback": {
        let lapsed = Array.isArray(body.lapsed) ? body.lapsed : [];
        if (lapsed.length === 0 && key) {
          const pulled = await pullLapsedCustomers(key, trace);
          if (pulled) {
            lapsed = pulled.lapsed;
            trace.flag("source", "shopify");
          }
        }
        trace.setInput(lapsed.map((l: { customer?: string }) => l?.customer ?? "").join("; "));
        actions = await runWinback(lapsed, trace, context);
        break;
      }
      case "quote-followup": {
        let quotes = Array.isArray(body.quotes) ? body.quotes : [];
        if (quotes.length === 0 && key) {
          const pulled = await pullOpenEstimates(key, trace);
          if (pulled) {
            quotes = pulled.quotes;
            trace.flag("source", "quickbooks");
            // A previously chased quote that's no longer pending → it converted.
            const svc = getServiceClient();
            if (svc) {
              const won = await resolveOutcomes(svc, pulled.clientId, "quote-followup", quotes.map((q) => `Quote ${q.number ?? ""}`));
              if (won) trace.flag("resolved", won);
            }
          }
        }
        trace.setInput(quotes.map((q: { customer?: string }) => q?.customer ?? "").join("; "));
        actions = await runQuoteFollowup(quotes, trace, context);
        break;
      }
      case "hiring-assist": {
        const applicants = Array.isArray(body.applicants) ? body.applicants : [];
        trace.setInput(applicants.map((a: { name?: string }) => a?.name ?? "").join("; "));
        actions = await runHiringAssist(applicants, trace, context);
        break;
      }
      case "referral-ask": {
        const moments = Array.isArray(body.moments) ? body.moments : [];
        trace.setInput(moments.map((m: { customer?: string }) => m?.customer ?? "").join("; "));
        actions = await runReferralAsk(moments, trace, context);
        break;
      }
      case "noshow-shield": {
        let appointments = Array.isArray(body.appointments) ? body.appointments : [];
        if (appointments.length === 0 && key) {
          const pulled = await pullUpcomingAppointments(key, trace);
          if (pulled) {
            appointments = pulled.appointments;
            trace.flag("source", "gcal");
          }
        }
        trace.setInput(appointments.map((a: { customer?: string }) => a?.customer ?? "").join("; "));
        actions = await runNoshowShield(appointments, trace, context);
        break;
      }
      case "review-response": {
        const reviews = Array.isArray(body.reviews) ? body.reviews : [];
        trace.setInput(reviews.map((r: { reviewer?: string }) => r?.reviewer ?? "").join("; "));
        actions = await runReviewResponse(reviews, trace, context);
        break;
      }
      case "shift-cover": {
        const callout = body.callout && typeof body.callout === "object" ? body.callout : {};
        const candidates = Array.isArray(body.candidates) ? body.candidates : [];
        trace.setInput(`${callout?.shift ?? ""} → ${candidates.length} candidates`);
        actions = await runShiftCover(callout, candidates, trace, context);
        break;
      }
      case "content-drafter": {
        const requests = Array.isArray(body.requests) ? body.requests : [];
        trace.setInput(requests.map((r: { channel?: string }) => r?.channel ?? "").join("; "));
        actions = await runContentDrafter(requests, trace, context);
        break;
      }
      case "doc-chaser": {
        const docs = Array.isArray(body.docs) ? body.docs : [];
        trace.setInput(docs.map((d: { client?: string }) => d?.client ?? "").join("; "));
        actions = await runDocChaser(docs, trace, context);
        break;
      }
      case "dispute-fighter": {
        const disputes = Array.isArray(body.disputes) ? body.disputes : [];
        trace.setInput(disputes.map((d: { orderRef?: string }) => d?.orderRef ?? "").join("; "));
        actions = await runDisputeFighter(disputes, trace, context);
        break;
      }
      default: {
        const messages = Array.isArray(body.messages) ? body.messages : [];
        trace.setInput(messages.map((m) => m?.subject ?? "").join("; "));
        actions = await runInboxTriage(messages, trace, context);
      }
    }
    trace.setPrompt(promptVersion(body.agent));
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

          const toQueue: { client_id: string; agent: string; action: string; summary: string; dedupe_key: string; payload: Record<string, unknown> }[] = [];
          for (const a of needApproval) {
            // Deterministic key: the SAME action proposed by a racing run (cron
            // tick vs manual portal run) collapses to one via the unique index.
            const dkey = dedupeKey({ clientId: client.id, kind: body.agent ?? null, action: a.action, ref: a.source });
            const canAuto =
              autoSend && !policyBlocks(policy, a, spentSoFar) && (a.action === "email.send" || a.action === "sms.send");
            if (canAuto && a.to && a.draft) {
              // Claim-before-send: insert the pending outcome (the send ledger)
              // keyed by dkey. Only the run that WINS the insert may send; a
              // concurrent run hits the unique index (no row returned) and skips,
              // so the customer never gets two copies of the same message.
              const { data: claim } = await supabase
                .from("outcomes")
                .upsert(
                  {
                    client_id: client.id,
                    agent: a.agent,
                    action: a.action,
                    kind: body.agent ?? null,
                    status: "pending",
                    value: Number(a.value) || 0,
                    detail: a.summary,
                    ref: a.source,
                    dedupe_key: dkey,
                  },
                  { onConflict: "dedupe_key", ignoreDuplicates: true }
                )
                .select("id")
                .maybeSingle();

              if (!claim) {
                // Another run already claimed this exact action — suppress the send.
                await supabase.from("agent_audit").insert({
                  client_id: client.id,
                  actor: "runtime",
                  action: "action.deduped",
                  detail: `${a.action} → ${a.to} (auto-send; duplicate suppressed)`,
                });
                continue;
              }

              const ok =
                a.action === "sms.send"
                  ? await sendSmsForClient(supabase, client.id, a.to, a.draft)
                  : await sendAgentEmail(a.to, a.source, a.draft);
              if (ok) {
                autoSent += 1;
                spentSoFar += Number(a.value) || 0; // count against the daily cap
              } else {
                // Send failed → release the claim so a later run may retry.
                await supabase.from("outcomes").delete().eq("id", (claim as { id: string }).id);
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
                dedupe_key: dkey,
                payload: {
                  draft: a.draft ?? null,
                  source: a.source,
                  to: a.to ?? null,
                  value: a.value ?? null,
                  kind: body.agent ?? null,
                  run_id: runId,
                  // BYOT tool.call carries its target + args; executed only on approval.
                  ...(a.tool ? { tool_id: a.tool.toolId, tool_name: a.tool.name, args: a.tool.args } : {}),
                },
              });
            }
          }

          if (toQueue.length) {
            // Upsert with ON CONFLICT DO NOTHING: duplicate queue rows from a
            // racing run are dropped, and .select() returns only the rows we
            // actually inserted, so `queued` reflects genuinely new work.
            const { data: inserted } = await supabase
              .from("approvals")
              .upsert(toQueue, { onConflict: "dedupe_key", ignoreDuplicates: true })
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
  } catch (err) {
    reportError(err, { source: "agent.run" });
    trace.setStatus("error");
    await trace.end();
    return NextResponse.json({ error: "run_failed" }, { status: 500 });
  }
}
