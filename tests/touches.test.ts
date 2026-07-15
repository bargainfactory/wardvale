import { describe, it, expect } from "vitest";
import { isImmediate, stepsToTouches, dueTouches, touchToApproval, type Step, type TouchRow } from "@/lib/orchestrator";

const NOW = new Date("2026-01-15T00:00:00Z").getTime();
const day = 86_400_000;

describe("isImmediate", () => {
  it("treats dueInDays 0 / absent as immediate, > 0 as scheduled", () => {
    expect(isImmediate({ kind: "outreach", action: "email.send", summary: "x", needsApproval: true, agent: "a" })).toBe(true);
    expect(isImmediate({ kind: "follow-up", action: "schedule", summary: "x", dueInDays: 0, needsApproval: true, agent: "a" })).toBe(true);
    expect(isImmediate({ kind: "follow-up", action: "schedule", summary: "x", dueInDays: 3, needsApproval: true, agent: "a" })).toBe(false);
  });
});

describe("stepsToTouches", () => {
  const steps: Step[] = [
    { kind: "outreach", action: "email.send", summary: "now", draft: "hi", needsApproval: true, agent: "a" },
    { kind: "follow-up", action: "schedule", summary: "3-day", dueInDays: 3, needsApproval: true, agent: "s" },
    { kind: "follow-up", action: "schedule", summary: "7-day", dueInDays: 7, needsApproval: true, agent: "s" },
  ];
  const rows = stepsToTouches("client-1", { email: "a@b.com" }, steps, "run-1", NOW);

  it("includes only the future steps", () => {
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.summary)).toEqual(["3-day", "7-day"]);
  });
  it("computes fire_at = now + dueInDays", () => {
    expect(rows[0].fire_at).toBe(new Date(NOW + 3 * day).toISOString());
    expect(rows[1].fire_at).toBe(new Date(NOW + 7 * day).toISOString());
  });
  it("gives each a distinct dedupe_key and carries client/run/recipient", () => {
    expect(new Set(rows.map((r) => r.dedupe_key)).size).toBe(2);
    expect(rows[0].client_id).toBe("client-1");
    expect(rows[0].run_id).toBe("run-1");
    expect(rows[0].recipient).toBe("a@b.com");
  });
});

describe("dueTouches", () => {
  const rows: (TouchRow & { status: string })[] = [
    { fire_at: new Date(NOW - day).toISOString(), status: "pending" } as never,
    { fire_at: new Date(NOW + day).toISOString(), status: "pending" } as never,
    { fire_at: new Date(NOW - day).toISOString(), status: "fired" } as never,
  ];
  it("returns only pending touches whose fire_at has arrived", () => {
    const due = dueTouches(rows, new Date(NOW).toISOString());
    expect(due).toHaveLength(1);
    expect(due[0].fire_at).toBe(new Date(NOW - day).toISOString());
  });
});

describe("touchToApproval", () => {
  const t: TouchRow = {
    client_id: "c1", run_id: "r1", kind: "follow-up", agent: "concierge:scheduler",
    summary: "3-day follow-up", draft: null, recipient: "a@b.com", learn_kind: "follow-up",
    dedupe_key: "orig-key", fire_at: new Date(NOW).toISOString(),
  };
  it("maps a draftless touch to a triage.label reminder approval", () => {
    const a = touchToApproval(t);
    expect(a.action).toBe("triage.label");
    expect(a.summary).toBe("3-day follow-up");
    expect(a.payload.run_id).toBe("r1");
    expect(a.payload.to).toBe("a@b.com");
  });
  it("maps a touch with a draft to an email.send approval", () => {
    expect(touchToApproval({ ...t, draft: "hello" }).action).toBe("email.send");
  });
});
