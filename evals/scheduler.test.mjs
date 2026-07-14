#!/usr/bin/env node
/**
 * Scheduler regression suite (roadmap G4). Proves the fairness + no-starvation
 * behavior that the old sequential, 50-capped for-loop got wrong, plus the
 * bounded-concurrency pool contract. Zero dependencies; exits non-zero on any
 * failure so it can gate CI.
 *
 *   node evals/scheduler.test.mjs
 *
 * Keep dueJobs() / runPool() below in sync with lib/scheduler.ts. The entitlement
 * check is injected here so these tests isolate the due/ordering logic from the
 * (separately-owned) plan rules in agents-catalog.
 */

const DUE_MS = { hourly: 60 * 60_000, daily: 24 * 60 * 60_000 };

// mirror of lib/scheduler.ts dueJobs (allowed() injected instead of imported)
function dueJobs(configs, clients, now, allowed) {
  const lastRun = (c) => (c.last_run_at ? new Date(c.last_run_at).getTime() : 0);
  return configs
    .filter((c) => {
      const client = clients.get(c.client_id);
      if (!client) return false;
      if (!allowed(client.plan, c.schedule)) return false;
      const interval = DUE_MS[c.schedule];
      if (!interval) return false;
      return now - lastRun(c) >= interval;
    })
    .sort((a, b) => lastRun(a) - lastRun(b))
    .map((c) => {
      const client = clients.get(c.client_id);
      return { configId: c.id, clientId: c.client_id, ingestKey: client.ingest_key, agentKey: c.agent_key };
    });
}

// mirror of lib/scheduler.ts runPool (backoff forced to 0 for deterministic tests)
async function runPool(items, worker, { concurrency = 6, retries = 2 } = {}) {
  const results = new Array(items.length);
  let next = 0;
  async function runOne(i) {
    const item = items[i];
    let attempts = 0;
    let error;
    while (attempts <= retries) {
      attempts++;
      try {
        if (await worker(item)) return void (results[i] = { item, ok: true, attempts });
        error = "worker returned false";
      } catch (e) {
        error = String(e);
      }
    }
    results[i] = { item, ok: false, attempts, error };
  }
  async function loop() {
    for (let i = next++; i < items.length; i = next++) await runOne(i);
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, loop));
  return results;
}

let pass = 0;
let fail = 0;
const check = (name, cond) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
};

const NOW = new Date("2026-01-15T12:00:00Z").getTime();
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();
const allowAll = () => true;
const clients = new Map([
  ["c1", { id: "c1", ingest_key: "k1", plan: "pro" }],
  ["c2", { id: "c2", ingest_key: "k2", plan: "pro" }],
  // c3 deliberately absent → models a suspended/inactive client
]);

console.log("\nScheduler — due detection");
{
  const configs = [
    { id: "a", client_id: "c1", agent_key: "ar-followup", schedule: "daily", last_run_at: hoursAgo(25) }, // due
    { id: "b", client_id: "c1", agent_key: "cart-recovery", schedule: "daily", last_run_at: hoursAgo(2) }, // not due
    { id: "c", client_id: "c2", agent_key: "lead-qualification", schedule: "hourly", last_run_at: hoursAgo(2) }, // due
    { id: "d", client_id: "c2", agent_key: "review-request", schedule: "hourly", last_run_at: null }, // never run → due
  ];
  const jobs = dueJobs(configs, clients, NOW, allowAll);
  const ids = jobs.map((j) => j.configId);
  check("a daily agent 25h stale is due", ids.includes("a"));
  check("a daily agent run 2h ago is NOT due", !ids.includes("b"));
  check("an hourly agent 2h stale is due", ids.includes("c"));
  check("a never-run agent is due", ids.includes("d"));
  check("carries the client's ingest key onto the job", jobs.find((j) => j.configId === "a").ingestKey === "k1");
}

console.log("\nScheduler — fairness & gating");
{
  const configs = [
    { id: "old", client_id: "c1", agent_key: "ar-followup", schedule: "hourly", last_run_at: hoursAgo(10) },
    { id: "older", client_id: "c2", agent_key: "ar-followup", schedule: "hourly", last_run_at: hoursAgo(50) },
    { id: "suspended", client_id: "c3", agent_key: "ar-followup", schedule: "hourly", last_run_at: hoursAgo(99) },
  ];
  const jobs = dueJobs(configs, clients, NOW, allowAll);
  check("oldest-due runs first (no starvation)", jobs[0].configId === "older");
  check("a suspended/absent client is skipped", !jobs.some((j) => j.configId === "suspended"));

  // entitlement gate: block hourly for a plan, keep daily
  const gated = dueJobs(
    [
      { id: "h", client_id: "c1", agent_key: "x", schedule: "hourly", last_run_at: hoursAgo(5) },
      { id: "dly", client_id: "c1", agent_key: "x", schedule: "daily", last_run_at: hoursAgo(30) },
    ],
    clients,
    NOW,
    (_plan, schedule) => schedule !== "hourly"
  );
  check("plan-disallowed cadence is filtered out", gated.map((j) => j.configId).join() === "dly");
}

console.log("\nScheduler — no silent cap (all due jobs surface)");
{
  const many = Array.from({ length: 120 }, (_, i) => ({
    id: `j${i}`,
    client_id: i % 2 ? "c1" : "c2",
    agent_key: "ar-followup",
    schedule: "hourly",
    last_run_at: hoursAgo(3 + i),
  }));
  const jobs = dueJobs(many, clients, NOW, allowAll);
  check("all 120 due jobs are returned (old code capped at 50)", jobs.length === 120);
}

async function poolTests() {
  console.log("\nScheduler — bounded-concurrency pool");
  {
    // every item processed exactly once, concurrency never exceeded
    const items = Array.from({ length: 20 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;
    const seen = new Set();
    const results = await runPool(
      items,
      async (i) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        seen.add(i);
        inFlight--;
        return true;
      },
      { concurrency: 4 }
    );
    check("all items processed exactly once", seen.size === 20 && results.every((r) => r.ok));
    check("concurrency cap respected (≤4 in flight)", maxInFlight <= 4);
  }
  {
    // a worker that fails twice then succeeds → retried, ends ok
    let calls = 0;
    const [r] = await runPool([{ tag: "flaky" }], async () => ++calls >= 3, { retries: 2 });
    check("a job that fails twice is retried and then succeeds", r.ok && r.attempts === 3);

    // a permanently failing worker → marked failed after retries+1 attempts
    const [f] = await runPool([{ tag: "dead" }], async () => false, { retries: 2 });
    check("a permanently failing job is marked failed after 3 attempts", !f.ok && f.attempts === 3);

    // a throwing worker never rejects the pool
    const [t] = await runPool([{ tag: "boom" }], async () => {
      throw new Error("kaboom");
    }, { retries: 1 });
    check("a throwing job is caught, not fatal", !t.ok && t.attempts === 2);
  }
}

await poolTests();

console.log(`\n${fail === 0 ? "✓" : "✗"} scheduler: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
