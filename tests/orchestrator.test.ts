import { describe, it, expect } from "vitest";
import {
  initState,
  mergeSteps,
  classifyIntent,
  runConcierge,
  type Intent,
  type Step,
  type ConciergeDeps,
  type ConciergeState,
} from "@/lib/orchestrator";

const kinds = (s: ConciergeState) => s.steps.map((x) => x.kind);

describe("classifyIntent", () => {
  it("hot on buying signals / questions", () => {
    expect(classifyIntent({ message: "I want a quote for pricing" }).intent).toBe("hot");
    expect(classifyIntent({ message: "Do you have availability tonight?" }).intent).toBe("hot");
  });
  it("cold on opt-out", () => {
    expect(classifyIntent({ message: "please unsubscribe me" }).intent).toBe("cold");
  });
  it("warm otherwise", () => {
    expect(classifyIntent({ message: "just browsing your site" }).intent).toBe("warm");
  });
});

describe("mergeSteps (reducer)", () => {
  const base = initState({});
  const s: Step = { kind: "outreach", action: "email.send", summary: "hi", needsApproval: true, agent: "x" };

  it("appends and bumps version", () => {
    const next = mergeSteps(base, [s], "b");
    expect(next.steps).toHaveLength(1);
    expect(next.version).toBe(base.version + 1);
  });
  it("dedupes identical steps across merges", () => {
    const once = mergeSteps(base, [s], "b");
    const twice = mergeSteps(once, [s], "b");
    expect(twice.steps).toHaveLength(1);
  });
});

describe("runConcierge (supervisor)", () => {
  const fake = (intent: Intent): ConciergeDeps => ({
    qualify: async () => ({ intent, reason: "test" }),
    draftOutreach: async () => ({ summary: "outreach", draft: "hello" }),
  });

  it("hot lead → outreach + follow-up, all human-gated", async () => {
    const s = await runConcierge({ email: "a@b.com" }, fake("hot"));
    expect(s.intent).toBe("hot");
    expect(kinds(s)).toEqual(["outreach", "follow-up"]);
    expect(s.steps.every((x) => x.needsApproval)).toBe(true);
  });

  it("cold lead → label only", async () => {
    const s = await runConcierge({}, fake("cold"));
    expect(kinds(s)).toEqual(["label"]);
  });

  it("runs the order side-quest in parallel and merges it", async () => {
    const deps: ConciergeDeps = {
      ...fake("hot"),
      orderSideQuest: async () => [{ kind: "review", action: "email.send", summary: "review", needsApproval: true, agent: "r" }],
    };
    const s = await runConcierge({ email: "a@b.com", hasOrder: true }, deps);
    expect(kinds(s)).toContain("outreach");
    expect(kinds(s)).toContain("review");
  });

  it("a failing branch is logged, not fatal — sibling steps survive", async () => {
    const deps: ConciergeDeps = {
      ...fake("hot"),
      orderSideQuest: async () => {
        throw new Error("boom");
      },
    };
    const s = await runConcierge({ email: "a@b.com", hasOrder: true }, deps);
    expect(kinds(s)).toContain("outreach"); // outreach branch still merged
    expect(s.log).toContain("branch-failed");
  });
});
