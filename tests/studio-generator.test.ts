import { describe, it, expect } from "vitest";
import { planFromIntake, type StudioIntake } from "@/lib/studio-generator";
import { policyBlocks } from "@/lib/policy";
import type { AgentKey } from "@/lib/agents-catalog";

const enabledKeys = (plan: ReturnType<typeof planFromIntake>) =>
  plan.agents.filter((a) => a.enabled).map((a) => a.key);
const autoKeys = (plan: ReturnType<typeof planFromIntake>) =>
  plan.agents.filter((a) => a.autoSend).map((a) => a.key);

describe("planFromIntake — purity & defaults", () => {
  it("is deterministic: identical answers → identical plan", () => {
    const intake: StudioIntake = { version: 1, goals: { agents: ["inbox-triage", "review-request"] } };
    const a = planFromIntake(intake, { plan: "growth" });
    const b = planFromIntake(intake, { plan: "growth" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("empty intake defaults to inbox-triage, draft-first, no policy row", () => {
    const plan = planFromIntake({ version: 1 }, { plan: "growth" });
    expect(enabledKeys(plan)).toEqual(["inbox-triage"]);
    expect(autoKeys(plan)).toEqual([]);
    expect(plan.policy).toEqual({ dailySpendCap: null, requireApprovalOver: null, allowedDomains: null });
  });
});

describe("planFromIntake — autonomy safe-defaults", () => {
  it("auto-inbound arms ONLY inbound-reply agents and writes non-OPEN policy", () => {
    const intake: StudioIntake = {
      version: 1,
      goals: { agents: ["inbox-triage", "support-triage", "cart-recovery", "lead-qualification"] },
      autonomy: { mode: "auto-inbound" },
    };
    const plan = planFromIntake(intake, { plan: "scale" });
    // cold-outreach agents are never auto-armed
    expect(autoKeys(plan).sort()).toEqual(["inbox-triage", "support-triage"]);
    expect(plan.agents.find((a) => a.key === "cart-recovery")?.autoSend).toBe(false);
    expect(plan.agents.find((a) => a.key === "lead-qualification")?.autoSend).toBe(false);
    // policy is never left OPEN when any agent can auto-send
    expect(plan.policy.dailySpendCap).not.toBeNull();
    expect(plan.policy.requireApprovalOver).not.toBeNull();
    // a $250 outbound action must be forced to approval by that policy. loadPolicy
    // parses allowed_domains (CSV) into a string[] at runtime — mirror that shape.
    const runtimePolicy = {
      dailySpendCap: plan.policy.dailySpendCap,
      requireApprovalOver: plan.policy.requireApprovalOver,
      allowedDomains: [] as string[],
    };
    expect(policyBlocks(runtimePolicy, { action: "email.send", value: 250 }, 0)).toBe(true);
  });

  it("draft mode leaves everything approve-first and policy OPEN", () => {
    const plan = planFromIntake(
      { version: 1, goals: { agents: ["inbox-triage"] }, autonomy: { mode: "draft" } },
      { plan: "scale" }
    );
    expect(autoKeys(plan)).toEqual([]);
    expect(plan.policy.requireApprovalOver).toBeNull();
    expect(plan.policy.dailySpendCap).toBeNull();
  });

  it("'review every message' forces draft even if auto-inbound was chosen", () => {
    const plan = planFromIntake(
      {
        version: 1,
        goals: { agents: ["inbox-triage"] },
        autonomy: { mode: "auto-inbound" },
        evaluation: { reviewEveryMessage: true },
      },
      { plan: "scale" }
    );
    expect(autoKeys(plan)).toEqual([]);
  });
});

describe("planFromIntake — plan cap & ordering", () => {
  it("caps enabled agents to the plan's maxAgents (Trial → 1)", () => {
    const plan = planFromIntake(
      { version: 1, goals: { agents: ["cart-recovery", "inbox-triage", "review-request"] } },
      { plan: "trial" }
    );
    expect(enabledKeys(plan)).toHaveLength(1);
  });

  it("honors the owner's priority ordering under the cap", () => {
    const priorities: AgentKey[] = ["review-request"];
    const plan = planFromIntake(
      { version: 1, goals: { agents: ["inbox-triage", "review-request"], priorities } },
      { plan: "trial" }
    );
    expect(enabledKeys(plan)).toEqual(["review-request"]);
  });
});

describe("planFromIntake — regulated verticals", () => {
  it("forces draft-first and adds a compliance guardrail for clinics", () => {
    const plan = planFromIntake(
      {
        version: 1,
        vertical: "clinic",
        goals: { agents: ["inbox-triage"] },
        autonomy: { mode: "auto-inbound" },
      },
      { plan: "scale" }
    );
    expect(autoKeys(plan)).toEqual([]);
    expect(plan.profile.guardrails ?? "").toMatch(/medical or legal advice/i);
  });
});

describe("planFromIntake — constraints", () => {
  it("normalizes allowed domains and folds never-do rules into guardrails", () => {
    const plan = planFromIntake(
      {
        version: 1,
        goals: { agents: ["inbox-triage"] },
        constraints: { allowedDomains: "@Acme.com, client.org , acme.com", neverDo: "promise refunds" },
      },
      { plan: "growth" }
    );
    expect(plan.policy.allowedDomains).toBe("acme.com,client.org");
    expect(plan.profile.guardrails ?? "").toMatch(/promise refunds/i);
  });

  it("never leaves a negative owner cap in the policy", () => {
    const plan = planFromIntake(
      {
        version: 1,
        goals: { agents: ["inbox-triage"] },
        autonomy: { mode: "auto-inbound" },
        constraints: { dailySpendCap: -5, approvalThreshold: -1 },
      },
      { plan: "growth" }
    );
    // negative overrides are rejected → safe defaults still apply (non-null)
    expect(plan.policy.dailySpendCap).toBeGreaterThan(0);
    expect(plan.policy.requireApprovalOver).toBeGreaterThan(0);
  });
});
