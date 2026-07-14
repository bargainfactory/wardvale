import { describe, it, expect } from "vitest";
import { rankExemplars, formatExemplars, type ExemplarCandidate, type JudgeInfo } from "@/lib/feedback";

const cand = (o: Partial<ExemplarCandidate>): ExemplarCandidate => ({
  kind: "approved",
  sample: "s",
  approvalId: null,
  createdAt: "2026-01-15T00:00:00Z",
  ...o,
});

describe("rankExemplars (judge-curated)", () => {
  it("drops judge-failed drafts — never teach from a bad one", () => {
    const c = [cand({ sample: "bad", approvalId: "a1" }), cand({ sample: "good", approvalId: "a2" })];
    const judged = new Map<string, JudgeInfo>([
      ["a1", { overall: 2, verdict: "fail" }],
      ["a2", { overall: 4.5, verdict: "pass" }],
    ]);
    expect(rankExemplars(c, judged, 5)).toEqual(["good"]);
  });

  it("ranks higher judge score first; an unjudged draft sits between pass and fail", () => {
    const c = [cand({ sample: "mid", approvalId: null }), cand({ sample: "top", approvalId: "a1" })];
    const judged = new Map<string, JudgeInfo>([["a1", { overall: 5, verdict: "pass" }]]);
    expect(rankExemplars(c, judged, 5)).toEqual(["top", "mid"]);
  });

  it("prefers owner-edited over approved at equal score", () => {
    const c = [
      cand({ sample: "approved", kind: "approved" }),
      cand({ sample: "edited", kind: "edited" }),
    ];
    expect(rankExemplars(c, new Map(), 5)[0]).toBe("edited");
  });

  it("respects the limit", () => {
    const c = [cand({ sample: "1" }), cand({ sample: "2" }), cand({ sample: "3" })];
    expect(rankExemplars(c, new Map(), 2)).toHaveLength(2);
  });
});

describe("formatExemplars", () => {
  it("includes approved and rejected blocks", () => {
    const out = formatExemplars(["good draft"], ["bad draft"]);
    expect(out).toContain("OWNER APPROVED");
    expect(out).toContain("good draft");
    expect(out).toContain("OWNER REJECTED");
    expect(out).toContain("bad draft");
  });

  it("omits an empty block, and returns empty string for nothing", () => {
    expect(formatExemplars(["x"], [])).not.toContain("REJECTED");
    expect(formatExemplars([], [])).toBe("");
  });
});
