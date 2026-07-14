import { describe, it, expect } from "vitest";
import { dueJobs, runPool, type ConfigRow, type ClientLite } from "@/lib/scheduler";

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
