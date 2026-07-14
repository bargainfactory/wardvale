import { describe, it, expect } from "vitest";
import { graceForKind, GRACE_BY_KIND } from "@/lib/outcomes";

describe("graceForKind (per-action-type resolution windows)", () => {
  it("uses the per-kind window", () => {
    expect(graceForKind("cart-recovery")).toBe(GRACE_BY_KIND["cart-recovery"]);
    expect(graceForKind("review-request")).toBe(GRACE_BY_KIND["review-request"]);
  });

  it("falls back to the default for unknown or empty kinds", () => {
    const def = graceForKind("not-a-kind");
    expect(graceForKind(null)).toBe(def);
    expect(graceForKind(undefined)).toBe(def);
  });

  it("fast funnels resolve sooner than slow ones", () => {
    expect(graceForKind("cart-recovery")).toBeLessThan(graceForKind("ar-followup"));
    expect(graceForKind("ar-followup")).toBeLessThan(graceForKind("review-request"));
  });

  it("a valid explicit override wins; an invalid one is ignored", () => {
    expect(graceForKind("cart-recovery", 1000)).toBe(1000);
    expect(graceForKind("cart-recovery", -5)).toBe(GRACE_BY_KIND["cart-recovery"]);
    expect(graceForKind("cart-recovery", null)).toBe(GRACE_BY_KIND["cart-recovery"]);
  });
});
