import { describe, it, expect } from "vitest";
import { componentChecks, aggregate, type Scores } from "@/lib/judge";
import { rankExemplars, formatExemplars, type ExemplarCandidate, type JudgeInfo } from "@/lib/feedback";
import { graceForKind } from "@/lib/outcomes";

// End-to-end flywheel over the REAL modules — checks → judges → curates → resolves.
// NOTE: this exercises the pipeline logic in-process with no DB or LLM. It is NOT
// a run against live customer traffic (that needs the deployed app + Supabase +
// OPENAI_API_KEY). It proves the loop is wired correctly before it touches
// production, and guards the wiring against regressions.
describe("flywheel (in-process, real modules — not live traffic)", () => {
  it("runs a decision through check → judge → curate → resolve", () => {
    // 1. A drafted decision clears the cheap deterministic tier.
    const decision = {
      action: "email.send",
      summary: "Payment reminder",
      draft: "Hi — a quick reminder that your invoice is due. Happy to help!",
      to: "customer@example.com",
      needsApproval: true,
    };
    const comp = componentChecks(decision, { inputText: "can you remind me about invoice 42?" });
    expect(comp.failed).toBe(0);

    // 2. The judge verdict gates on grounding + safety (real aggregation).
    const goodScores: Scores = { grounding: 5, appropriateness: 4, tone: 4, safety: 5 };
    const ungrounded: Scores = { grounding: 2, appropriateness: 5, tone: 5, safety: 5 };
    expect(aggregate(goodScores).verdict).toBe("pass");
    expect(aggregate(ungrounded).verdict).toBe("fail");

    // 3. Curation feeds the judge-passed draft back and drops the failed one,
    //    even though the failed one is newer.
    const candidates: ExemplarCandidate[] = [
      { kind: "approved", sample: "GOOD draft", approvalId: "good", createdAt: "2026-01-15T00:00:00Z" },
      { kind: "approved", sample: "BAD draft", approvalId: "bad", createdAt: "2026-01-16T00:00:00Z" },
    ];
    const judged = new Map<string, JudgeInfo>([
      ["good", { overall: aggregate(goodScores).overall, verdict: "pass" }],
      ["bad", { overall: aggregate(ungrounded).overall, verdict: "fail" }],
    ]);
    const curated = rankExemplars(candidates, judged, 3);
    expect(curated).toEqual(["GOOD draft"]);

    const block = formatExemplars(curated, ["a REJECTED draft"]);
    expect(block).toContain("GOOD draft");
    expect(block).toContain("REJECTED");
    expect(block).not.toContain("BAD draft");

    // 4. Resolution grace adapts to the action type (attribution accuracy).
    expect(graceForKind("cart-recovery")).toBeLessThan(graceForKind("ar-followup"));
  });
});
