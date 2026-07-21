import { describe, it, expect } from "vitest";
import { bundles } from "@/lib/solutions";
import { getPack, PACKS } from "@/lib/agents-catalog";

describe("bundle → pack linkage (interview dashboard)", () => {
  it("every bundle links to a real pack", () => {
    for (const b of bundles) {
      expect(b.packId, `${b.slug} has no packId`).toBeTruthy();
      expect(getPack(b.packId!), `${b.slug} → ${b.packId} is not a real pack`).toBeDefined();
    }
  });

  it("every pack is reachable from at least one bundle (no orphan packs in the funnel)", () => {
    const linked = new Set(bundles.map((b) => b.packId));
    for (const p of PACKS) expect(linked.has(p.id), `pack ${p.id} has no bundle`).toBe(true);
  });
});
