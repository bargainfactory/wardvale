import { dedupeKey } from "@/lib/dedupe";

// ── New-Lead Concierge orchestration (roadmap Phase 3 · U2/U3, slice 1) ──────
// A lightweight supervisor that routes a new lead across specialized sub-agents:
// qualify → branch on intent (hot/warm/cold) → draft outreach + schedule a
// follow-up, while an order/invoice side-quest fans out in PARALLEL. Every
// branch's proposed steps merge into one TYPED, VERSIONED state through a reducer
// so concurrent branches can't clobber each other. Sub-agents are injected
// (dependency injection = graph nodes), so the flow is testable with fakes and
// wireable to the real LLM agents. Each step is human-gated (needsApproval) so
// the existing policy/approval layer stays authoritative.
//
// When a heavier engine is warranted (many nodes, durable resumable state),
// adopt LangGraph.js — the plan's "buy the engine, build the graphs". For one
// workflow, this ~100-line supervisor is the right amount of machinery.

export type Intent = "hot" | "warm" | "cold" | "unknown";

export type Lead = {
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  message?: string;
  hasOrder?: boolean; // references an existing order/invoice → order side-quest
  orderStatus?: "paid" | "overdue"; // slice 3: routes the side-quest (review vs AR)
};

export type Step = {
  kind: "outreach" | "nurture" | "follow-up" | "review" | "ar" | "label";
  action: string; // email.send | sms.send | schedule | triage.label
  summary: string;
  draft?: string;
  dueInDays?: number; // slice 3: cadence offset for scheduled touches
  needsApproval: boolean;
  agent: string;
};

/** Typed, versioned shared state. Every mutation bumps `version`; steps merge
 *  through the reducer so parallel branches can't clobber each other. */
export type ConciergeState = {
  version: number;
  lead: Lead;
  intent: Intent;
  reason: string;
  steps: Step[];
  log: string[];
};

export function initState(lead: Lead): ConciergeState {
  return { version: 1, lead, intent: "unknown", reason: "", steps: [], log: ["init"] };
}

/**
 * Reducer: merge new steps into state safely — append, dedupe by
 * kind+action+summary, bump the version, and record the transition. Safe to call
 * with the results of concurrent branches.
 */
export function mergeSteps(state: ConciergeState, steps: Step[], note: string): ConciergeState {
  const key = (s: Step) => `${s.kind}|${s.action}|${s.summary}`;
  const seen = new Set(state.steps.map(key));
  const fresh = steps.filter((s) => !seen.has(key(s)));
  return {
    ...state,
    version: state.version + 1,
    steps: [...state.steps, ...fresh],
    log: [...state.log, `${note} (+${fresh.length})`],
  };
}

/**
 * Deterministic intent classifier — mirrors the lead-qualification heuristic so
 * the workflow runs with no API key. The real supervisor injects an LLM qualifier
 * (see ConciergeDeps).
 */
export function classifyIntent(lead: Lead): { intent: Intent; reason: string } {
  const t = `${lead.message ?? ""} ${lead.source ?? ""}`.toLowerCase();
  if (/unsubscribe|not interested|\bstop\b|remove me|spam/.test(t)) return { intent: "cold", reason: "opt-out / not interested" };
  if (/\b(buy|purchase|quote|pricing|price|book|booking|demo|ready|urgent|asap|today|need)\b|\?/.test(t))
    return { intent: "hot", reason: "buying-intent signal" };
  return { intent: "warm", reason: "general interest" };
}

export type ConciergeDeps = {
  qualify: (lead: Lead) => Promise<{ intent: Intent; reason: string }> | { intent: Intent; reason: string };
  draftOutreach: (lead: Lead, intent: Intent) => Promise<{ summary: string; draft: string }> | { summary: string; draft: string };
  orderSideQuest?: (lead: Lead) => Promise<Step[]>;
};

/** Default deps: heuristic classifier + a template outreach. Keyless-safe; the
 *  API route can swap in the LLM lead-qualification + drafting sub-agents. */
export const defaultDeps: ConciergeDeps = {
  qualify: (lead) => classifyIntent(lead),
  draftOutreach: (lead, intent) => ({
    summary: `${intent} lead — first touch to ${lead.name || lead.email || "lead"}`,
    draft: `Hi ${lead.name || "there"} — thanks for reaching out${lead.source ? ` via ${lead.source}` : ""}! Happy to help. When's a good time for a quick call?`,
  }),
};

/**
 * Supervisor. Qualifies, routes on intent, fans out the order side-quest in
 * parallel, and reduces every branch into one typed state. A branch that throws
 * is logged and skipped — it never kills the workflow.
 */
export async function runConcierge(lead: Lead, deps: ConciergeDeps = defaultDeps): Promise<ConciergeState> {
  let state = initState(lead);

  const q = await Promise.resolve(deps.qualify(lead)).catch(() => classifyIntent(lead));
  state = { ...state, version: state.version + 1, intent: q.intent, reason: q.reason, log: [...state.log, `qualify:${q.intent}`] };

  const branches: Promise<Step[]>[] = [];

  if (q.intent === "hot" || q.intent === "warm") {
    const isHot = q.intent === "hot";
    const kind: Step["kind"] = isHot ? "outreach" : "nurture";
    branches.push(
      Promise.resolve(deps.draftOutreach(lead, q.intent)).then((o): Step[] => {
        const steps: Step[] = [
          { kind, action: lead.email ? "email.send" : "sms.send", summary: o.summary, draft: o.draft, needsApproval: true, agent: "concierge:outreach" },
        ];
        if (isHot) {
          steps.push({ kind: "follow-up", action: "schedule", summary: "Same-day follow-up", dueInDays: 0, needsApproval: true, agent: "concierge:scheduler" });
        } else {
          // Warm nurture cadence: a light multi-touch sequence.
          steps.push({ kind: "follow-up", action: "schedule", summary: "3-day nurture follow-up", dueInDays: 3, needsApproval: true, agent: "concierge:scheduler" });
          steps.push({ kind: "follow-up", action: "schedule", summary: "7-day check-in", dueInDays: 7, needsApproval: true, agent: "concierge:scheduler" });
        }
        return steps;
      })
    );
  } else if (q.intent === "cold") {
    branches.push(Promise.resolve<Step[]>([{ kind: "label", action: "triage.label", summary: `Cold: ${q.reason}`, needsApproval: true, agent: "concierge:triage" }]));
  }

  if (lead.hasOrder && deps.orderSideQuest) branches.push(Promise.resolve(deps.orderSideQuest(lead)));

  const settled = await Promise.allSettled(branches);
  for (const r of settled) {
    state = r.status === "fulfilled" ? mergeSteps(state, r.value, "branch") : { ...state, version: state.version + 1, log: [...state.log, "branch-failed"] };
  }
  return state;
}

/**
 * Route the order side-quest by order state (slice 3): an overdue invoice → AR
 * follow-up; otherwise a review request. Pure; the route injects it as the
 * `orderSideQuest` node.
 */
export function defaultOrderSideQuest(lead: Lead): Step[] {
  const name = lead.name || "the customer";
  if (lead.orderStatus === "overdue") {
    return [
      {
        kind: "ar",
        action: "email.send",
        summary: `Payment reminder for ${name}'s overdue invoice`,
        draft: `Hi ${name} — a quick reminder that your recent invoice is now past due. Let us know if you have any questions; happy to help sort it out.`,
        needsApproval: true,
        agent: "concierge:ar",
      },
    ];
  }
  return [
    {
      kind: "review",
      action: "email.send",
      summary: `Ask ${name} for a review of their recent order`,
      draft: `Hi ${name} — hope you're loving your recent order! Would you mind leaving a quick review? It really helps.`,
      needsApproval: true,
      agent: "concierge:review",
    },
  ];
}

// ── Persistence: concierge steps → approval-queue rows (slice 2) ─────────────
// Map each step onto the nearest registered agent lane so approved drafts feed
// the right agent's learning-loop exemplars; steps with no lane keep their own.
export const LEARN_KIND: Record<string, string> = {
  outreach: "lead-qualification",
  nurture: "lead-qualification",
  review: "review-request",
  ar: "ar-followup",
};

export type ApprovalRow = {
  agent: string;
  action: string;
  summary: string;
  dedupe_key: string;
  payload: { draft: string | null; source: string; to: string | null; value: null; kind: string; run_id: string };
};

/**
 * Map merged concierge steps to approval-queue rows, reusing dedupeKey and the
 * run route's payload shape so the existing decide / judge / learning-loop
 * machinery works on orchestrated steps unchanged. Pure + testable.
 */
export function stepsToApprovals(clientId: string, lead: Lead, steps: Step[], runId: string): ApprovalRow[] {
  const ref = lead.email || lead.phone || "";
  return steps.map((s) => {
    const kind = LEARN_KIND[s.kind] ?? s.kind;
    return {
      agent: s.agent,
      action: s.action,
      summary: s.summary,
      dedupe_key: dedupeKey({ clientId, kind, action: s.action, ref: ref || s.summary }),
      payload: {
        draft: s.draft ?? null,
        source: lead.source || ref || s.summary,
        to: lead.email || lead.phone || null,
        value: null,
        kind,
        run_id: runId,
      },
    };
  });
}
