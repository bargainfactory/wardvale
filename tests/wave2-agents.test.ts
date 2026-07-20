import { describe, it, expect } from "vitest";
import { AGENTS, AGENT_KEYS, PACKS, PLANS, isAgentKey, type AgentKey } from "@/lib/agents-catalog";
import { planFromIntake, type StudioIntake } from "@/lib/studio-generator";
import { runWinback, runQuoteFollowup, runHiringAssist, runReferralAsk, runReviewResponse, runShiftCover } from "@/lib/runtime";

const WAVE2: AgentKey[] = [
  "winback",
  "quote-followup",
  "hiring-assist",
  "referral-ask",
  "noshow-shield",
  "review-response",
  "shift-cover",
  "content-drafter",
  "doc-chaser",
  "dispute-fighter",
];

describe("catalog integrity (wave 2)", () => {
  it("has 16 unique agents and every wave-2 key registered", () => {
    expect(AGENTS.length).toBe(16);
    expect(new Set(AGENT_KEYS).size).toBe(16);
    for (const k of WAVE2) expect(isAgentKey(k), k).toBe(true);
  });

  it("every pack references only valid agent keys", () => {
    for (const p of PACKS) {
      for (const a of p.agents) expect(isAgentKey(a), `${p.id} → ${a}`).toBe(true);
      expect(new Set(p.agents).size).toBe(p.agents.length);
    }
  });

  it("has 20 packs: 6 original + 6 gap-closers + 8 new verticals, unique ids", () => {
    expect(PACKS.length).toBe(20);
    expect(new Set(PACKS.map((p) => p.id)).size).toBe(20);
    for (const id of ["medspa", "veterinary", "fitness", "auto-repair", "insurance", "property-management", "salon", "accounting", "contractor", "cleaning", "childcare", "str", "nonprofit", "photographer"]) {
      expect(PACKS.some((p) => p.id === id), id).toBe(true);
    }
  });

  it("scale plan grows with the catalog", () => {
    expect(PLANS.scale.maxAgents).toBe(AGENTS.length);
  });
});

describe("studio generator — wave-2 agents are NEVER auto-armed", () => {
  it("auto-inbound mode still arms only the original inbound-reply agents", () => {
    const intake: StudioIntake = {
      version: 1,
      goals: { agents: [...WAVE2, "inbox-triage", "support-triage"] },
      autonomy: { mode: "auto-inbound" },
    };
    const plan = planFromIntake(intake, { plan: "scale" });
    const auto = plan.agents.filter((a) => a.autoSend).map((a) => a.key).sort();
    expect(auto).toEqual(["inbox-triage", "support-triage"]);
    for (const k of WAVE2) {
      expect(plan.agents.find((a) => a.key === k)?.autoSend, `${k} must never auto-send`).toBe(false);
    }
  });
});

describe("regulated verticals force approve-first", () => {
  for (const vertical of ["medspa", "veterinary", "insurance", "accounting", "childcare", "clinic", "law-firm"]) {
    it(`${vertical}: auto-inbound is overridden to draft-first`, () => {
      const plan = planFromIntake(
        { version: 1, vertical, goals: { agents: ["inbox-triage"] }, autonomy: { mode: "auto-inbound" } },
        { plan: "scale" }
      );
      expect(plan.agents.some((a) => a.autoSend)).toBe(false);
      expect(plan.profile.guardrails ?? "").toMatch(/medical or legal advice/i);
    });
  }
});

describe("wave-2 lanes (offline template path)", () => {
  it("winback drafts are approval-gated with value attribution", async () => {
    const actions = await runWinback([{ customer: "Ana", email: "ana@x.com", lastPurchase: "haircut", daysSince: 60, totalSpent: 400 }]);
    expect(actions).toHaveLength(1);
    expect(actions[0].needsApproval).toBe(true);
    expect(actions[0].action).toBe("email.send");
    expect(actions[0].value).toBe(100); // totalSpent / 4
    expect(actions[0].draft).toMatch(/while/i);
  });

  it("quote follow-up carries the quote amount as value", async () => {
    const actions = await runQuoteFollowup([{ customer: "Bob", email: "b@x.com", number: "142", amount: 2400, service: "roof repair", daysOld: 9 }]);
    expect(actions[0].needsApproval).toBe(true);
    expect(actions[0].value).toBe(2400);
    expect(actions[0].draft).toContain("142");
  });

  it("hiring first-touch replies to the applicant", async () => {
    const actions = await runHiringAssist([{ name: "Cara", email: "c@x.com", role: "line cook" }]);
    expect(actions[0].needsApproval).toBe(true);
    expect(actions[0].to).toBe("c@x.com");
    expect(actions[0].draft).toMatch(/line cook/);
  });

  it("referral ask prefers SMS when a phone exists", async () => {
    const actions = await runReferralAsk([{ customer: "Dee", phone: "+15550001", trigger: "5-star review" }]);
    expect(actions[0].action).toBe("sms.send");
    expect(actions[0].needsApproval).toBe(true);
  });

  it("review responses: negatives escalate, positives stay labeled drafts — never sends", async () => {
    const actions = await runReviewResponse([
      { reviewer: "Ed", rating: 1, text: "cold food", platform: "Google" },
      { reviewer: "Flo", rating: 5, text: "amazing!", platform: "Google" },
    ]);
    expect(actions[0].action).toBe("escalate");
    expect(actions[1].action).toBe("triage.label");
    for (const a of actions) {
      expect(a.needsApproval).toBe(true);
      expect(a.action).not.toBe("email.send");
      expect(a.action).not.toBe("sms.send");
    }
  });

  it("shift cover texts each candidate individually, capped and gated", async () => {
    const actions = await runShiftCover(
      { shift: "Sat 2-8pm", role: "server" },
      [
        { name: "Gia", phone: "+15550002", hoursThisWeek: 20 },
        { name: "Hal", phone: "+15550003", hoursThisWeek: 34 },
      ]
    );
    expect(actions).toHaveLength(2);
    for (const a of actions) {
      expect(a.action).toBe("sms.send");
      expect(a.needsApproval).toBe(true);
      expect(a.draft).toMatch(/Sat 2-8pm/);
    }
    // never leak one candidate's info to another
    expect(actions[0].draft).not.toMatch(/Hal/);
    expect(actions[1].draft).not.toMatch(/Gia/);
  });
});
