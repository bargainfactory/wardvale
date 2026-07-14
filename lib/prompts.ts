import { AGENT_KEYS, type AgentKey } from "@/lib/agents-catalog";

// ── Prompt version registry (roadmap G8) ─────────────────────────────────────
// Every agent's system prompt has a version here. When you change a prompt's
// wording, bump its version — traces record `prompt_version`, so the LLM-judge
// layer (U1) and the ROI attribution can tie a quality score or a realized
// dollar back to the EXACT prompt that produced it. This is the join key that
// makes "prompt v2 lifted realized ROI 8%" a provable statement instead of a
// hunch, and it's why versioning is a precondition for the judge layer.
//
// The prompt bodies still live next to each agent in lib/runtime.ts; migrating
// them into this registry is incremental. The contract for now: change a body →
// bump its version here.

export const PROMPT_VERSION: Record<AgentKey | "default", string> = {
  "inbox-triage": "inbox-triage@1",
  "ar-followup": "ar-followup@1",
  "cart-recovery": "cart-recovery@1",
  "review-request": "review-request@1",
  "lead-qualification": "lead-qualification@1",
  "support-triage": "support-triage@1",
  default: "default@1",
};

/** The prompt version for an agent key; falls back to `default` for unknown/empty. */
export function promptVersion(agentKey: string | null | undefined): string {
  if (agentKey && (AGENT_KEYS as readonly string[]).includes(agentKey)) {
    return PROMPT_VERSION[agentKey as AgentKey];
  }
  return PROMPT_VERSION.default;
}
