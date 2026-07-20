import { describe, it, expect } from "vitest";
import { calendarEventsToAppointments, type GCalEvent } from "@/lib/integrations";

const NOW = new Date("2026-07-20T12:00:00Z").getTime();
const TZ = "America/New_York";
const at = (hoursFromNow: number) => new Date(NOW + hoursFromNow * 3_600_000).toISOString();

const guest = (over: Partial<NonNullable<GCalEvent["attendees"]>[number]> = {}) => ({
  email: "pat@example.com",
  displayName: "Pat Doe",
  responseStatus: "needsAction",
  ...over,
});

describe("calendarEventsToAppointments", () => {
  it("maps a normal upcoming event to a confirm item in the client's timezone", () => {
    const items = calendarEventsToAppointments(
      [{ status: "confirmed", summary: "Cleaning + exam", start: { dateTime: at(24) }, attendees: [guest()] }],
      NOW,
      TZ
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("confirm");
    expect(items[0].customer).toBe("Pat Doe");
    expect(items[0].email).toBe("pat@example.com");
    expect(items[0].service).toBe("Cleaning + exam");
    expect(items[0].when).toMatch(/Jul 21/); // 24h out, formatted for humans
  });

  it("flags invite non-responders as the no-show risk cohort; accepted = no risk", () => {
    const items = calendarEventsToAppointments(
      [
        { summary: "A", start: { dateTime: at(20) }, attendees: [guest()] },
        { summary: "B", start: { dateTime: at(21) }, attendees: [guest({ responseStatus: "accepted" })] },
      ],
      NOW,
      TZ
    );
    expect(items[0].risk).toMatch(/hasn't responded/);
    expect(items[1].risk).toBe("");
  });

  it("skips cancelled events, all-day events, and declined attendees", () => {
    const items = calendarEventsToAppointments(
      [
        { status: "cancelled", summary: "gone", start: { dateTime: at(20) }, attendees: [guest()] },
        { summary: "all-day", start: { date: "2026-07-21" }, attendees: [guest()] },
        { summary: "declined", start: { dateTime: at(20) }, attendees: [guest({ responseStatus: "declined" })] },
      ],
      NOW,
      TZ
    );
    expect(items).toHaveLength(0);
  });

  it("skips events with only self/organizer attendees (internal meetings)", () => {
    const items = calendarEventsToAppointments(
      [{ summary: "standup", start: { dateTime: at(20) }, attendees: [guest({ self: true }), guest({ organizer: true, email: "owner@biz.com" })] }],
      NOW,
      TZ
    );
    expect(items).toHaveLength(0);
  });

  it("only confirms the 2h–48h window — not imminent, not next week", () => {
    const items = calendarEventsToAppointments(
      [
        { summary: "too soon", start: { dateTime: at(1) }, attendees: [guest()] },
        { summary: "in window", start: { dateTime: at(3) }, attendees: [guest()] },
        { summary: "too far", start: { dateTime: at(72) }, attendees: [guest()] },
      ],
      NOW,
      TZ
    );
    expect(items.map((i) => i.service)).toEqual(["in window"]);
  });

  it("falls back to the email local-part when no display name", () => {
    const items = calendarEventsToAppointments(
      [{ summary: "trim", start: { dateTime: at(5) }, attendees: [guest({ displayName: undefined })] }],
      NOW,
      TZ
    );
    expect(items[0].customer).toBe("pat");
  });

  it("caps output at 20 items", () => {
    const events: GCalEvent[] = Array.from({ length: 30 }, (_, i) => ({
      summary: `slot ${i}`,
      start: { dateTime: at(3 + (i * 40) / 60) },
      attendees: [guest({ email: `p${i}@x.com` })],
    }));
    expect(calendarEventsToAppointments(events, NOW, TZ)).toHaveLength(20);
  });
});
