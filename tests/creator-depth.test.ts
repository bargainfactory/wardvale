import { describe, it, expect } from "vitest";
import { formatContext } from "@/lib/context";
import { planFromIntake, type StudioIntake } from "@/lib/studio-generator";
import { PROMPT_VERSION } from "@/lib/prompts";

describe("formatContext — rate card + voice samples (Creator OS depth)", () => {
  it("injects a RATE CARD block with quoting/lowball guidance", () => {
    const ctx = formatContext({ industry: "Creator", rateCard: "Sponsored video: $2,000 min. Never crypto." });
    expect(ctx).toMatch(/RATE CARD & QUOTING RULES/);
    expect(ctx).toMatch(/\$2,000 min/);
    expect(ctx).toMatch(/below these rates|exposure/i); // the anti-lowball instruction
  });

  it("injects VOICE EXAMPLES the model is told to match", () => {
    const ctx = formatContext({ voiceSamples: ["hey! love your stuff", "thanks so much for reaching out"] });
    expect(ctx).toMatch(/VOICE EXAMPLES/);
    expect(ctx).toContain("hey! love your stuff");
    expect(ctx).toContain("Example 2");
  });

  it("caps voice samples at 5 and trims empties", () => {
    const many = Array.from({ length: 9 }, (_, i) => `msg ${i}`);
    const ctx = formatContext({ voiceSamples: [...many, "", "   "] });
    expect(ctx).toContain("Example 5");
    expect(ctx).not.toContain("Example 6");
  });

  it("returns empty when nothing is present (unchanged behavior)", () => {
    expect(formatContext({})).toBe("");
    expect(formatContext(null)).toBe("");
  });

  it("still emits business + guardrails blocks alongside the new ones", () => {
    const ctx = formatContext({
      industry: "Creator",
      guardrails: "Never accept gambling sponsors",
      rateCard: "Story: $400",
      voiceSamples: ["yo"],
    });
    expect(ctx).toMatch(/BUSINESS CONTEXT/);
    expect(ctx).toMatch(/RULES —/);
    expect(ctx).toMatch(/RATE CARD/);
    expect(ctx).toMatch(/VOICE EXAMPLES/);
  });
});

describe("studio generator — rate card + voice flow through to the plan", () => {
  it("carries rateCard and splits voiceSamples on blank lines (capped)", () => {
    const intake: StudioIntake = {
      version: 1,
      goals: { agents: ["lead-qualification"] },
      advanced: {
        rateCard: "Sponsored video $2k min",
        voiceSamples: "First past email here.\n\nSecond one here.\n\nThird.",
      },
    };
    const plan = planFromIntake(intake, { plan: "growth" });
    expect(plan.profile.rateCard).toBe("Sponsored video $2k min");
    expect(plan.profile.voiceSamples).toEqual(["First past email here.", "Second one here.", "Third."]);
  });

  it("empty advanced → null rate card, empty voice array", () => {
    const plan = planFromIntake({ version: 1, goals: { agents: ["inbox-triage"] } }, { plan: "growth" });
    expect(plan.profile.rateCard).toBeNull();
    expect(plan.profile.voiceSamples).toEqual([]);
  });
});

describe("lead-qualifier prompt version bumped for rate-card behavior", () => {
  it("is at v2 (traceability of the quoting/scam-flag change)", () => {
    expect(PROMPT_VERSION["lead-qualification"]).toBe("lead-qualification@2");
  });
});
