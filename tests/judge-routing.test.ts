import { describe, it, expect } from "vitest";
import { routingSignal, routingMismatch, componentChecks, type Decision } from "@/lib/judge";

describe("routingSignal", () => {
  it("classifies promo/newsletter as archive", () => {
    expect(routingSignal("Unsubscribe from our newsletter")).toBe("archive");
    expect(routingSignal("50% off SALE this weekend")).toBe("archive");
  });
  it("classifies urgent/refund/legal as escalate", () => {
    expect(routingSignal("URGENT: I demand a refund now")).toBe("escalate");
    expect(routingSignal("I will be filing a lawsuit")).toBe("escalate");
  });
  it("classifies questions/bookings as reply", () => {
    expect(routingSignal("Do you have a table for 4 tonight?")).toBe("reply");
  });
  it("returns unknown for neutral text", () => {
    expect(routingSignal("thanks, received")).toBe("unknown");
  });
});

describe("routingMismatch (conservative)", () => {
  it("flags messaging a promo and archiving an urgent message", () => {
    expect(routingMismatch("archive", "email.send")).toBe(true);
    expect(routingMismatch("escalate", "archive")).toBe(true);
  });
  it("does not flag reasonable routings", () => {
    expect(routingMismatch("reply", "email.send")).toBe(false);
    expect(routingMismatch("escalate", "escalate")).toBe(false);
    expect(routingMismatch("archive", "archive")).toBe(false);
    expect(routingMismatch("unknown", "email.send")).toBe(false);
  });
});

describe("componentChecks — routing-consistent", () => {
  const routing = (d: Decision, inputText: string) =>
    componentChecks(d, { inputText }).checks.find((c) => c.name === "routing-consistent")?.pass;

  it("fails when a promo/newsletter is auto-replied to", () => {
    expect(routing({ action: "email.send", summary: "s", draft: "d", to: "a@b.com", needsApproval: true }, "unsubscribe newsletter")).toBe(false);
  });
  it("fails when an urgent refund is archived", () => {
    expect(routing({ action: "archive", summary: "s" }, "URGENT refund please")).toBe(false);
  });
  it("passes a sensible routing", () => {
    expect(routing({ action: "email.send", summary: "s", draft: "d", to: "a@b.com", needsApproval: true }, "can I book a table?")).toBe(true);
  });
});
