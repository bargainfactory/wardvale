import { describe, it, expect } from "vitest";
import { dedupeKey, dayBucket, makeLedger } from "@/lib/dedupe";

describe("dedupeKey", () => {
  it("is identical for the same logical action on the same UTC day", () => {
    const a = dedupeKey({ clientId: "c1", kind: "ar-followup", action: "email.send", ref: "Invoice INV-1", day: "2026-01-15" });
    const b = dedupeKey({ clientId: "c1", kind: "ar-followup", action: "email.send", ref: "  invoice inv-1 ", day: "2026-01-15" });
    expect(a).toBe(b); // ref is normalized (case + surrounding space)
  });

  it("differs across days so a legitimate next-day follow-up is allowed", () => {
    const d1 = dedupeKey({ clientId: "c1", action: "email.send", ref: "X", day: "2026-01-15" });
    const d2 = dedupeKey({ clientId: "c1", action: "email.send", ref: "X", day: "2026-01-16" });
    expect(d1).not.toBe(d2);
  });

  it("differs across refs, actions, and clients", () => {
    const base = { clientId: "c1", action: "email.send", day: "2026-01-15" } as const;
    expect(dedupeKey({ ...base, ref: "A" })).not.toBe(dedupeKey({ ...base, ref: "B" }));
    expect(dedupeKey({ ...base, ref: "A" })).not.toBe(dedupeKey({ ...base, ref: "A", action: "escalate" }));
    expect(dedupeKey({ ...base, ref: "A" })).not.toBe(dedupeKey({ ...base, ref: "A", clientId: "c2" }));
  });

  it("dayBucket returns a UTC calendar day", () => {
    expect(dayBucket(new Date("2026-01-15T23:59:59Z"))).toBe("2026-01-15");
  });
});

describe("makeLedger (models the unique index / ON CONFLICT DO NOTHING)", () => {
  it("claims a key once; the racing claim loses", () => {
    const led = makeLedger();
    expect(led.claim("k")).toBe(true);
    expect(led.claim("k")).toBe(false);
    expect(led.size).toBe(1);
  });

  it("release lets a later claim (retry) succeed", () => {
    const led = makeLedger();
    led.claim("k");
    led.release("k");
    expect(led.claim("k")).toBe(true);
  });

  it("two overlapping runs queue each action exactly once", () => {
    const led = makeLedger();
    const batch = ["INV-1", "INV-2", "INV-3"].map((ref) =>
      dedupeKey({ clientId: "c1", kind: "ar-followup", action: "email.send", ref, day: "2026-01-15" })
    );
    const run = () => batch.filter((k) => led.claim(k)).length;
    expect(run()).toBe(3); // first run claims all
    expect(run()).toBe(0); // racing run claims none
    expect(led.size).toBe(3);
  });
});
