import { describe, it, expect } from "vitest";
import { dueJobs, runPool, localParts, dueCustomAutomations, type ConfigRow, type ClientLite, type CustomAutomationRow } from "@/lib/scheduler";

const NOW = new Date("2026-01-15T12:00:00Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

// growth + scale allow hourly AND daily (see agents-catalog PLANS).
const clients = new Map<string, ClientLite>([
  ["c1", { id: "c1", ingest_key: "k1", plan: "growth" }],
  ["c2", { id: "c2", ingest_key: "k2", plan: "scale" }],
]);
const cfg = (over: Partial<ConfigRow>): ConfigRow => ({
  id: "x",
  client_id: "c1",
  agent_key: "ar-followup",
  schedule: "daily",
  last_run_at: null,
  ...over,
});

describe("dueJobs", () => {
  it("includes stale + never-run configs, excludes recently-run ones", () => {
    const jobs = dueJobs(
      [
        cfg({ id: "due", schedule: "daily", last_run_at: hoursAgo(25) }),
        cfg({ id: "fresh", schedule: "daily", last_run_at: hoursAgo(2) }),
        cfg({ id: "never", client_id: "c2", schedule: "hourly", last_run_at: null }),
      ],
      clients,
      NOW
    );
    const ids = jobs.map((j) => j.configId);
    expect(ids).toContain("due");
    expect(ids).not.toContain("fresh");
    expect(ids).toContain("never");
  });

  it("orders oldest-due first (fairness / no starvation)", () => {
    const jobs = dueJobs(
      [
        cfg({ id: "recent", client_id: "c1", schedule: "hourly", last_run_at: hoursAgo(3) }),
        cfg({ id: "ancient", client_id: "c2", schedule: "hourly", last_run_at: hoursAgo(50) }),
      ],
      clients,
      NOW
    );
    expect(jobs[0].configId).toBe("ancient");
  });

  it("skips a suspended / absent client", () => {
    const jobs = dueJobs([cfg({ id: "ghost", client_id: "c9", last_run_at: hoursAgo(99) })], clients, NOW);
    expect(jobs).toHaveLength(0);
  });

  it("applies the REAL plan entitlement — starter has no hourly cadence", () => {
    const starter = new Map<string, ClientLite>([["s", { id: "s", ingest_key: "ks", plan: "starter" }]]);
    const jobs = dueJobs(
      [
        cfg({ id: "h", client_id: "s", schedule: "hourly", last_run_at: hoursAgo(5) }),
        cfg({ id: "d", client_id: "s", schedule: "daily", last_run_at: hoursAgo(30) }),
      ],
      starter,
      NOW
    );
    expect(jobs.map((j) => j.configId)).toEqual(["d"]);
  });

  it("does not cap the batch (the old for-loop stopped at 50)", () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      cfg({ id: `j${i}`, client_id: i % 2 ? "c1" : "c2", schedule: "hourly", last_run_at: hoursAgo(3 + i) })
    );
    expect(dueJobs(many, clients, NOW)).toHaveLength(120);
  });

  it("carries the client's ingest key onto the job", () => {
    const [job] = dueJobs([cfg({ id: "j", client_id: "c1", last_run_at: hoursAgo(25) })], clients, NOW);
    expect(job.ingestKey).toBe("k1");
  });
});

// NOW is 2026-01-15T12:00:00Z — a Thursday (day=4), 12:00 UTC, 07:00 in New York.
describe("localParts", () => {
  it("resolves hour + weekday in the given timezone", () => {
    expect(localParts(NOW, "UTC")).toEqual({ hour: 12, day: 4 });
    expect(localParts(NOW, "America/New_York")).toEqual({ hour: 7, day: 4 });
  });

  it("falls back to UTC on a bad timezone string", () => {
    expect(localParts(NOW, "Not/AZone")).toEqual({ hour: 12, day: 4 });
    expect(localParts(NOW, null)).toEqual({ hour: 12, day: 4 });
  });
});

describe("dueJobs — preferred-hour gating", () => {
  const tzClients = new Map<string, ClientLite>([
    ["utc", { id: "utc", ingest_key: "ku", plan: "growth", timezone: "UTC" }],
    ["ny", { id: "ny", ingest_key: "kn", plan: "growth", timezone: "America/New_York" }],
  ]);

  it("daily + run_hour fires only at the matching local hour", () => {
    const jobs = dueJobs(
      [
        cfg({ id: "hit", client_id: "utc", last_run_at: hoursAgo(25), run_hour: 12 }),
        cfg({ id: "wrong-hour", client_id: "utc", last_run_at: hoursAgo(25), run_hour: 13 }),
        cfg({ id: "wrong-tz", client_id: "ny", last_run_at: hoursAgo(25), run_hour: 12 }), // NY local = 07
        cfg({ id: "ny-local", client_id: "ny", last_run_at: hoursAgo(25), run_hour: 7 }),
      ],
      tzClients,
      NOW
    );
    expect(jobs.map((j) => j.configId).sort()).toEqual(["hit", "ny-local"]);
  });

  it("tolerance: a stamp ~22h old still fires at the matching hour (no 24h drift)", () => {
    const jobs = dueJobs(
      [
        cfg({ id: "tolerant", client_id: "utc", last_run_at: hoursAgo(22), run_hour: 12 }),
        cfg({ id: "too-fresh", client_id: "utc", last_run_at: hoursAgo(2), run_hour: 12 }),
      ],
      tzClients,
      NOW
    );
    expect(jobs.map((j) => j.configId)).toEqual(["tolerant"]);
  });

  it("weekly + run_day fires only on the matching local weekday", () => {
    const jobs = dueJobs(
      [
        cfg({ id: "thu", client_id: "utc", schedule: "weekly", last_run_at: hoursAgo(8 * 24), run_hour: 12, run_day: 4 }),
        cfg({ id: "fri", client_id: "utc", schedule: "weekly", last_run_at: hoursAgo(8 * 24), run_hour: 12, run_day: 5 }),
      ],
      tzClients,
      NOW
    );
    expect(jobs.map((j) => j.configId)).toEqual(["thu"]);
  });

  it("hourly ignores run_hour — it fires every elapsed hour", () => {
    const jobs = dueJobs([cfg({ id: "h", client_id: "utc", schedule: "hourly", last_run_at: hoursAgo(2), run_hour: 3 })], tzClients, NOW);
    expect(jobs.map((j) => j.configId)).toEqual(["h"]);
  });
});

describe("dueCustomAutomations", () => {
  const mixed = new Map<string, ClientLite>([
    ["g", { id: "g", ingest_key: "kg", plan: "growth", timezone: "UTC" }],
    ["s", { id: "s", ingest_key: "ks", plan: "scale", timezone: "UTC" }],
    ["st", { id: "st", ingest_key: "kt", plan: "starter", timezone: "UTC" }],
    ["sp", { id: "sp", ingest_key: "kp", plan: "growth", timezone: "America/Sao_Paulo" }], // local 09:00
  ]);
  const row = (over: Partial<CustomAutomationRow>): CustomAutomationRow => ({
    id: "a",
    client_id: "g",
    schedule: "daily",
    run_hour: 12,
    run_day: null,
    last_run_at: null,
    ...over,
  });

  it("only growth/scale plans run custom automations", () => {
    const jobs = dueCustomAutomations(
      [row({ id: "g1", client_id: "g" }), row({ id: "s1", client_id: "s" }), row({ id: "t1", client_id: "st" })],
      mixed,
      NOW
    );
    expect(jobs.map((j) => j.automationId).sort()).toEqual(["g1", "s1"]);
  });

  it("'off' never runs; null run_hour defaults to 9 local", () => {
    const jobs = dueCustomAutomations(
      [
        row({ id: "off", schedule: "off" }),
        row({ id: "default-9-utc", client_id: "g", run_hour: null }), // UTC local = 12 ≠ 9
        row({ id: "default-9-sp", client_id: "sp", run_hour: null }), // São Paulo local = 09
      ],
      mixed,
      NOW
    );
    expect(jobs.map((j) => j.automationId)).toEqual(["default-9-sp"]);
  });

  it("weekly honors run_day and carries the ingest key", () => {
    const jobs = dueCustomAutomations(
      [row({ id: "w", schedule: "weekly", run_day: 4, last_run_at: hoursAgo(8 * 24) })],
      mixed,
      NOW
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].ingestKey).toBe("kg");
  });
});

describe("runPool", () => {
  it("processes every item exactly once, never exceeding the concurrency cap", async () => {
    let inFlight = 0;
    let max = 0;
    const seen = new Set<number>();
    const items = Array.from({ length: 20 }, (_, i) => i);
    const res = await runPool(
      items,
      async (i) => {
        inFlight++;
        max = Math.max(max, inFlight);
        await Promise.resolve();
        seen.add(i);
        inFlight--;
        return true;
      },
      { concurrency: 4, backoffMs: () => 0 }
    );
    expect(seen.size).toBe(20);
    expect(res.every((r) => r.ok)).toBe(true);
    expect(max).toBeLessThanOrEqual(4);
  });

  it("retries a transient failure, then succeeds", async () => {
    let calls = 0;
    const [r] = await runPool([1], async () => ++calls >= 3, { retries: 2, backoffMs: () => 0 });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(3);
  });

  it("marks a permanent failure failed after retries + 1 attempts", async () => {
    const [r] = await runPool([1], async () => false, { retries: 2, backoffMs: () => 0 });
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(3);
  });

  it("catches a throwing worker — the pool never rejects", async () => {
    const [r] = await runPool(
      [1],
      async () => {
        throw new Error("boom");
      },
      { retries: 1, backoffMs: () => 0 }
    );
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(2);
  });
});
