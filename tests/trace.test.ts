import { describe, it, expect } from "vitest";
import { shouldPersistTrace } from "@/lib/trace";

describe("shouldPersistTrace (sampling with always-keep-interesting)", () => {
  it("always keeps error traces, even at sample rate 0", () => {
    expect(shouldPersistTrace("error", {}, 0.99, 0)).toBe(true);
  });

  it("always keeps interesting flags", () => {
    expect(shouldPersistTrace("ok", { injection: true }, 0.99, 0)).toBe(true);
    expect(shouldPersistTrace("ok", { source_error: "shopify" }, 0.99, 0)).toBe(true);
    expect(shouldPersistTrace("ok", { mode: "heuristic-fallback" }, 0.99, 0)).toBe(true);
  });

  it("samples ordinary traces by rate (keep iff rand < rate)", () => {
    expect(shouldPersistTrace("ok", {}, 0.4, 0.5)).toBe(true);
    expect(shouldPersistTrace("ok", {}, 0.6, 0.5)).toBe(false);
  });

  it("rate 1 keeps everything; rate 0 drops ordinary traces", () => {
    expect(shouldPersistTrace("ok", {}, 0.999, 1)).toBe(true);
    expect(shouldPersistTrace("ok", {}, 0, 0)).toBe(false);
  });
});
