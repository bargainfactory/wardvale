import { describe, it, expect } from "vitest";
import { trajectoryChecks } from "@/lib/judge";

const passed = (checks: { name: string; pass: boolean }[], name: string) => checks.find((c) => c.name === name)?.pass;

describe("trajectoryChecks (full-cycle, over trace spans)", () => {
  it("passes a healthy trajectory: read → model → decided", () => {
    const spans = [{ name: "guardrail" }, { name: "model.start" }, { name: "model.end" }, { name: "decided" }];
    const checks = trajectoryChecks(spans, {}, "ok");
    expect(passed(checks, "read-before-decide")).toBe(true);
    expect(passed(checks, "model-or-clean-fallback")).toBe(true);
    expect(passed(checks, "trace-completed")).toBe(true);
  });

  it("accepts a clean heuristic fallback (no model span, but flagged)", () => {
    const checks = trajectoryChecks([{ name: "guard" }, { name: "decided" }], { mode: "heuristic-fallback" }, "ok");
    expect(passed(checks, "model-or-clean-fallback")).toBe(true);
  });

  it("flags a decision made with no reading and a silent no-op", () => {
    const checks = trajectoryChecks([{ name: "decided" }], {}, "ok");
    expect(passed(checks, "read-before-decide")).toBe(false);
    expect(passed(checks, "model-or-clean-fallback")).toBe(false);
  });

  it("flags an errored trace", () => {
    const checks = trajectoryChecks([{ name: "model.start" }], {}, "error");
    expect(passed(checks, "trace-completed")).toBe(false);
  });
});
