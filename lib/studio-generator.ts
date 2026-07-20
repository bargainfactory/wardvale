import {
  AGENTS,
  entitlement,
  getPack,
  scheduleAllowed,
  type AgentKey,
  type Plan,
  type Schedule,
} from "@/lib/agents-catalog";

// ── Agent Design Studio: answers → proposed agent configuration (PURE) ────────
// The onboarding questionnaire produces a structured `StudioIntake`. `planFromIntake`
// maps it deterministically to a `ConfigPlan` — no DB, no model, no secrets — so it
// is safe to import into the client for the live review preview, and unit-testable.
// The impure applier that writes the plan lives in `lib/studio-apply.ts` (server-only).
// This pure/impure split mirrors formatContext/loadContext and policyBlocks/loadPolicy.

// Agents whose only outbound action is a reply to someone who already contacted
// the business — the ONLY agents the studio may ever arm for auto-send. Cold
// outreach (cart-recovery, lead-qualification, review-request, ar-followup) is
// never auto-armed at onboarding.
const INBOUND_REPLY_AGENTS: AgentKey[] = ["inbox-triage", "support-triage"];

// Verticals where every draft must wait for a human, regardless of the answer.
const REGULATED_VERTICALS = new Set(["clinic", "law-firm"]);

// Safe-default governance the generator MUST write whenever any agent is armed
// for auto-send, so a novice can never leave the policy fully OPEN.
const DEFAULT_APPROVAL_THRESHOLD = 25; // $ — queues every dollar-valued action
const DAILY_CAP_BY_PLAN: Record<Plan, number> = { trial: 200, starter: 200, growth: 500, scale: 1000 };

export type StudioIntake = {
  version: number;
  updatedAt?: string;
  vertical?: string; // Quick Start pack id, or "" for freeform
  advancedOptIn?: boolean;
  skipped?: string[]; // section ids the owner chose to skip
  context?: {
    businessName?: string;
    industry?: string;
    hours?: string;
    services?: string;
    pricing?: string;
    faq?: string;
    tone?: string;
    timezone?: string;
    teamSize?: string;
  };
  goals?: {
    agents?: AgentKey[]; // outcomes the owner picked, as agent keys
    priorities?: AgentKey[]; // ordered subset (priority ranking)
    successMetric?: string; // recorded as context only — no optimization loop
  };
  tools?: {
    connectors?: string[]; // recorded intent; OAuth launched from the UI
  };
  autonomy?: {
    mode?: "draft" | "auto-inbound"; // draft-first default
    cadence?: Schedule;
  };
  constraints?: {
    neverDo?: string;
    escalateWhen?: string;
    allowedDomains?: string; // CSV of recipient domains
    dailySpendCap?: number | null; // owner override of the auto-send $/day backstop
    approvalThreshold?: number | null; // owner override of require-approval-over $
  };
  evaluation?: {
    reviewEveryMessage?: boolean; // true → force draft mode
  };
  advanced?: {
    notes?: string;
  };
};

export type PlannedAgent = { key: AgentKey; enabled: boolean; autoSend: boolean; schedule: Schedule };
export type PlannedPolicy = {
  dailySpendCap: number | null;
  requireApprovalOver: number | null;
  allowedDomains: string | null;
};
export type ConfigPlan = {
  profile: {
    industry: string | null;
    tone: string | null;
    hours: string | null;
    services: string | null;
    pricing: string | null;
    faq: string | null;
    guardrails: string | null;
  };
  agents: PlannedAgent[]; // always all 6, with the enabled flag set
  policy: PlannedPolicy;
  rationale: string[]; // human-readable "why" lines for the review card
  intake: StudioIntake; // echoed for persistence
};

const trimOrNull = (v: string | undefined | null, n: number): string | null => {
  const s = (v ?? "").toString().trim().slice(0, n);
  return s || null;
};

/** Coerce an owner-supplied cap to a non-negative number, or null. */
const nonNegOrNull = (v: number | null | undefined): number | null => {
  const n = Number(v);
  return v == null || Number.isNaN(n) || n < 0 ? null : n;
};

/** Clean a CSV of recipient domains → lowercased, deduped CSV, or null. */
function normalizeDomains(csv: string | undefined | null): string | null {
  const parts = (csv ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter((d) => d.includes("."));
  const unique = Array.from(new Set(parts));
  return unique.length ? unique.join(",").slice(0, 500) : null;
}

/** Assemble the owner's "never do" rules + escalation + a compliance line. */
function buildGuardrails(
  neverDo: string | undefined,
  escalateWhen: string | undefined,
  regulated: boolean
): string | null {
  const lines: string[] = [];
  const nd = (neverDo ?? "").trim();
  const esc = (escalateWhen ?? "").trim();
  if (nd) lines.push(`Never: ${nd}`);
  if (esc) lines.push(`Escalate to a human when: ${esc}`);
  if (regulated) {
    lines.push(
      "Never provide medical or legal advice, never quote prices or make commitments, and escalate any regulated matter to a human."
    );
  }
  const out = lines.join("\n").slice(0, 2000);
  return out || null;
}

/** Order selected agents by the owner's priority ranking, then catalog order. */
function orderAgents(selected: Set<AgentKey>, priorities: AgentKey[] | undefined): AgentKey[] {
  const ordered: AgentKey[] = [];
  const push = (k: AgentKey) => {
    if (selected.has(k) && !ordered.includes(k)) ordered.push(k);
  };
  for (const k of priorities ?? []) push(k);
  for (const a of AGENTS) push(a.key);
  return ordered;
}

/**
 * Pure, deterministic mapping from questionnaire answers to a proposed config.
 * No DB, no model, no secrets — safe to run on the client to render the preview.
 */
export function planFromIntake(intake: StudioIntake, ctx: { plan: Plan }): ConfigPlan {
  const c = intake.context ?? {};
  const pack = intake.vertical ? getPack(intake.vertical) : undefined;
  const regulated = REGULATED_VERTICALS.has(intake.vertical ?? "");
  const maxAgents = entitlement(ctx.plan).maxAgents;

  // 1. Which agents — union of the Quick Start pack and the owner's chosen goals.
  const selected = new Set<AgentKey>([...(pack?.agents ?? []), ...(intake.goals?.agents ?? [])]);
  if (selected.size === 0) selected.add("inbox-triage"); // every business has email
  const ordered = orderAgents(selected, intake.goals?.priorities);
  const enabledKeys = new Set(ordered.slice(0, maxAgents));

  // 2. Autonomy — draft-first. "review every message" or a regulated vertical
  //    forces approve-first regardless of the chosen mode.
  const reviewEvery = intake.evaluation?.reviewEveryMessage === true;
  const mode = regulated || reviewEvery ? "draft" : intake.autonomy?.mode ?? "draft";
  const cadence: Schedule = intake.autonomy?.cadence ?? "manual";
  const schedule: Schedule = scheduleAllowed(ctx.plan, cadence) ? cadence : "manual";

  const agents: PlannedAgent[] = AGENTS.map((a) => {
    const enabled = enabledKeys.has(a.key);
    const autoSend = enabled && mode === "auto-inbound" && INBOUND_REPLY_AGENTS.includes(a.key);
    return { key: a.key, enabled, autoSend, schedule: enabled ? schedule : "manual" };
  });
  const anyAuto = agents.some((a) => a.autoSend);

  // 3. Governance — never leave the policy OPEN while auto-send is on. Owner caps
  //    are honored, but when any agent is armed the caps CANNOT be null: they
  //    fall back to safe defaults. Caps also protect a later portal opt-in.
  const wantCap = nonNegOrNull(intake.constraints?.dailySpendCap);
  const wantThreshold = nonNegOrNull(intake.constraints?.approvalThreshold);
  const policy: PlannedPolicy = {
    dailySpendCap: anyAuto ? wantCap ?? DAILY_CAP_BY_PLAN[ctx.plan] : wantCap,
    requireApprovalOver: anyAuto ? wantThreshold ?? DEFAULT_APPROVAL_THRESHOLD : wantThreshold,
    allowedDomains: normalizeDomains(intake.constraints?.allowedDomains),
  };

  // 4. Profile facts + the generated guardrail block.
  const profile = {
    industry: trimOrNull(c.industry ?? pack?.industry, 120),
    tone: trimOrNull(c.tone ?? pack?.tone, 200),
    hours: trimOrNull(c.hours, 300),
    services: trimOrNull(c.services, 1000),
    pricing: trimOrNull(c.pricing, 1000),
    faq: trimOrNull(c.faq, 3000),
    guardrails: buildGuardrails(intake.constraints?.neverDo, intake.constraints?.escalateWhen, regulated),
  };

  // 5. Rationale for the review card.
  const rationale: string[] = [];
  const enabledList = agents.filter((a) => a.enabled).map((a) => a.key);
  rationale.push(
    enabledList.length
      ? `Turning on ${enabledList.length} agent${enabledList.length > 1 ? "s" : ""}: ${enabledList.join(", ")}.`
      : "No agents selected yet."
  );
  if (ordered.length > maxAgents) {
    rationale.push(
      `Your plan runs ${maxAgents} agent${maxAgents > 1 ? "s" : ""} at once — ${ordered.length - maxAgents} more are ready when you upgrade.`
    );
  }
  rationale.push(
    anyAuto
      ? `Auto-send is on for inbound replies only, with approval required over $${DEFAULT_APPROVAL_THRESHOLD} and a $${DAILY_CAP_BY_PLAN[ctx.plan]}/day cap.`
      : "Every message is drafted for your approval — nothing sends on its own."
  );
  if (regulated) rationale.push("Regulated vertical: all drafts wait for a human, with a compliance guardrail added.");
  if (policy.allowedDomains) rationale.push(`Auto-send is limited to: ${policy.allowedDomains}.`);

  return { profile, agents, policy, rationale, intake };
}
