import { describe, it, expect } from "vitest";
import {
  initState,
  mergeSteps,
  classifyIntent,
  runConcierge,
  defaultOrderSideQuest,
  stepsToApprovals,
  LEARN_KIND,
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

  it("warm lead → nurture + a multi-touch cadence (slice 3)", async () => {
    const s = await runConcierge({ email: "a@b.com" }, fake("warm"));
    expect(kinds(s)).toEqual(["nurture", "follow-up", "follow-up"]);
    const cadence = s.steps.filter((x) => x.kind === "follow-up").map((x) => x.dueInDays);
    expect(cadence).toEqual([3, 7]);
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

describe("defaultOrderSideQuest (slice 3 — review vs AR by order state)", () => {
  it("routes an overdue invoice to an AR follow-up", () => {
    const steps = defaultOrderSideQuest({ name: "Sam", orderStatus: "overdue" });
    expect(steps[0].kind).toBe("ar");
    expect(steps[0].action).toBe("email.send");
  });
  it("routes a paid/unspecified order to a review request", () => {
    expect(defaultOrderSideQuest({ name: "Sam", orderStatus: "paid" })[0].kind).toBe("review");
    expect(defaultOrderSideQuest({ name: "Sam" })[0].kind).toBe("review");
  });
});

describe("stepsToApprovals (slice 2 — persistence mapping)", () => {
  const steps: Step[] = [
    { kind: "outreach", action: "email.send", summary: "first touch", draft: "hi", needsApproval: true, agent: "concierge:outreach" },
    { kind: "review", action: "email.send", summary: "ask for review", draft: "review pls", needsApproval: true, agent: "concierge:review" },
    { kind: "follow-up", action: "schedule", summary: "same-day", needsApproval: true, agent: "concierge:scheduler" },
  ];
  const rows = stepsToApprovals("client-1", { email: "lead@x.com", source: "form" }, steps, "run-abc");

  it("maps each step onto the run route's approval/payload shape", () => {
    expect(rows).toHaveLength(3);
    expect(rows[0].action).toBe("email.send");
    expect(rows[0].payload.draft).toBe("hi");
    expect(rows[0].payload.to).toBe("lead@x.com");
    expect(rows[0].payload.run_id).toBe("run-abc");
  });

  it("routes steps onto the nearest registered agent lane for learning", () => {
    expect(rows[0].payload.kind).toBe(LEARN_KIND.outreach); // "lead-qualification"
    expect(rows[1].payload.kind).toBe(LEARN_KIND.review); // "review-request"
    expect(rows[2].payload.kind).toBe("follow-up"); // no lane → keeps its own
  });

  it("gives every row a dedupe_key (idempotent upsert)", () => {
    expect(rows.every((r) => typeof r.dedupe_key === "string" && r.dedupe_key.length > 0)).toBe(true);
    // distinct steps → distinct keys
    expect(new Set(rows.map((r) => r.dedupe_key)).size).toBe(3);
  });
});
