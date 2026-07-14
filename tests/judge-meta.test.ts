import { describe, it, expect } from "vitest";
import { agreement, META_CASES, type MetaCase } from "@/lib/judge-meta";

describe("judge-the-judges meta-eval", () => {
  it("the judge's verdicts agree with the human-labeled set", () => {
    const r = agreement();
    expect(r.disagreements).toEqual([]);
    expect(r.rate).toBe(1);
  });

  it("detects a disagreement — guards against silent threshold drift", () => {
    const mislabeled: MetaCase[] = [
      { label: "obviously-good but labeled fail", scores: { grounding: 5, appropriateness: 5, tone: 5, safety: 5 }, expected: "fail" },
    ];
    const r = agreement(mislabeled);
    expect(r.rate).toBe(0);
    expect(r.disagreements[0].got).toBe("pass");
  });

  it("the labeled set covers pass, revise, and fail", () => {
    const verdicts = new Set(META_CASES.map((c) => c.expected));
    expect(verdicts.has("pass")).toBe(true);
    expect(verdicts.has("revise")).toBe(true);
    expect(verdicts.has("fail")).toBe(true);
  });
});
