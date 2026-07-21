import { scheduleAllowed, type Schedule } from "@/lib/agents-catalog";

// ── Scheduler core (roadmap G4) ──────────────────────────────────────────────
// Pure, testable pieces of the autonomous scheduler: deciding which agents are
// DUE (fairly, oldest-first so a backlog can't starve later clients) and running
// the dispatch with bounded concurrency + retry so one slow client can't block
// the rest. The cron route wires these to the DB and to the dispatch transport
// (QStash when configured, in-process fetch otherwise).

export const DUE_MS: Record<string, number> = {
  hourly: 60 * 60_000,
  daily: 24 * 60 * 60_000,
  weekly: 7 * 24 * 60 * 60_000,
};

// When a preferred hour gates the run, the elapsed-interval check gets a small
// tolerance: stamps land seconds after the tick, so a strict `>= 24h` would
// skip the matching hour a day later and drift the run 24h at a time.
const HOUR_GATE_TOLERANCE = 0.9;

export type ConfigRow = {
  id: string;
  client_id: string;
  agent_key: string;
  schedule: Schedule;
  last_run_at: string | null;
  /** Preferred local hour (0-23) in the client's timezone; null = any tick. */
  run_hour?: number | null;
  /** Preferred local weekday (0=Sun..6=Sat); only meaningful for weekly. */
  run_day?: number | null;
};
export type ClientLite = { id: string; ingest_key: string; plan: string; timezone?: string | null };
export type Job = { configId: string; clientId: string; ingestKey: string; agentKey: string };

/** Local {hour, day} for a timestamp in an IANA timezone (bad tz → UTC). */
export function localParts(now: number, tz: string | null | undefined): { hour: number; day: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      hour: "numeric",
      hour12: false,
      weekday: "short",
    });
    const parts = fmt.formatToParts(new Date(now));
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = days.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Sun");
    return { hour, day: day < 0 ? 0 : day };
  } catch {
    const d = new Date(now);
    return { hour: d.getUTCHours(), day: d.getUTCDay() };
  }
}

/** Shared due check: interval elapsed + (optional) local hour/day gates. */
function isDue(
  schedule: string,
  lastRunAt: string | null,
  runHour: number | null | undefined,
  runDay: number | null | undefined,
  tz: string | null | undefined,
  now: number
): boolean {
  const interval = DUE_MS[schedule];
  if (!interval) return false; // manual / off
  const last = lastRunAt ? new Date(lastRunAt).getTime() : 0;
  const gated = schedule !== "hourly" && runHour != null;
  const needed = gated ? interval * HOUR_GATE_TOLERANCE : interval;
  if (now - last < needed) return false;
  if (!gated) return true;
  const local = localParts(now, tz);
  if (local.hour !== runHour) return false;
  if (schedule === "weekly" && runDay != null && local.day !== runDay) return false;
  return true;
}

/**
 * The enabled+scheduled configs that are DUE now, for an active + plan-entitled
 * client, ordered oldest-run-first. Fairness matters: if more agents are due
 * than one invocation can process, the ones waiting longest go first, so nobody
 * is permanently starved. No cap here — the caller decides how many to take.
 *
 * Keep the due/ordering logic in sync with evals/scheduler.test.mjs.
 */
export function dueJobs(configs: ConfigRow[], clients: Map<string, ClientLite>, now: number): Job[] {
  const lastRun = (c: ConfigRow) => (c.last_run_at ? new Date(c.last_run_at).getTime() : 0);
  return configs
    .filter((c) => {
      const client = clients.get(c.client_id);
      if (!client) return false; // inactive / suspended
      if (!scheduleAllowed(client.plan, c.schedule)) return false; // plan entitlement
      return isDue(c.schedule, c.last_run_at, c.run_hour, c.run_day, client.timezone, now);
    })
    .sort((a, b) => lastRun(a) - lastRun(b)) // oldest-due first
    .map((c) => {
      const client = clients.get(c.client_id)!;
      return { configId: c.id, clientId: c.client_id, ingestKey: client.ingest_key, agentKey: c.agent_key };
    });
}

export type CustomAutomationRow = {
  id: string;
  client_id: string;
  schedule: string; // 'off' | 'daily' | 'weekly'
  run_hour: number | null;
  run_day: number | null;
  last_run_at: string | null;
};
export type CustomJob = { automationId: string; clientId: string; ingestKey: string };

/**
 * Due custom automations (portal composer). Gated to Growth+ — the plans the
 * Custom add-on sells against — and always hour-gated (run_hour defaults to 9).
 */
export function dueCustomAutomations(
  rows: CustomAutomationRow[],
  clients: Map<string, ClientLite>,
  now: number
): CustomJob[] {
  const lastRun = (r: CustomAutomationRow) => (r.last_run_at ? new Date(r.last_run_at).getTime() : 0);
  return rows
    .filter((r) => {
      const client = clients.get(r.client_id);
      if (!client) return false;
      if (client.plan !== "growth" && client.plan !== "scale") return false;
      return isDue(r.schedule, r.last_run_at, r.run_hour ?? 9, r.run_day, client.timezone, now);
    })
    .sort((a, b) => lastRun(a) - lastRun(b))
    .map((r) => ({ automationId: r.id, clientId: r.client_id, ingestKey: clients.get(r.client_id)!.ingest_key }));
}

export type JobResult<T> = { item: T; ok: boolean; attempts: number; error?: string };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Bounded-concurrency runner with per-item retry + backoff. Never rejects —
 * returns one result per item (preserving input order). A slow item only ever
 * occupies a single worker slot, so it can't block the others. `worker` returns
 * true on success; false or a throw triggers a retry up to `retries` times.
 *
 * Keep the pool contract in sync with evals/scheduler.test.mjs.
 */
export async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<boolean>,
  opts: { concurrency?: number; retries?: number; backoffMs?: (attempt: number) => number } = {}
): Promise<JobResult<T>[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  const retries = Math.max(0, opts.retries ?? 2);
  const backoff = opts.backoffMs ?? ((n) => 200 * 2 ** n);
  const results = new Array<JobResult<T>>(items.length);
  let next = 0;

  async function runOne(i: number): Promise<void> {
    const item = items[i];
    let attempts = 0;
    let error: string | undefined;
    while (attempts <= retries) {
      attempts++;
      try {
        if (await worker(item)) {
          results[i] = { item, ok: true, attempts };
          return;
        }
        error = "worker returned false";
      } catch (e) {
        error = String(e);
      }
      if (attempts <= retries) await sleep(backoff(attempts - 1));
    }
    results[i] = { item, ok: false, attempts, error };
  }

  async function loop(): Promise<void> {
    for (let i = next++; i < items.length; i = next++) await runOne(i);
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, loop));
  return results;
}

/** True when durable dispatch (Upstash QStash) is configured. */
export function qstashConfigured(): boolean {
  return Boolean(process.env.QSTASH_TOKEN);
}

/**
 * Publish one agent-run job to Upstash QStash, which delivers it to `destUrl`
 * with the client's bearer (via an Upstash-Forward header) and handles retry +
 * dead-letter. Returns true when QStash accepts the message.
 */
export async function publishToQStash(
  destUrl: string,
  ingestKey: string,
  agentKey: string,
  extra?: Record<string, unknown>
): Promise<boolean> {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return false;
  const res = await fetch(`https://qstash.upstash.io/v2/publish/${destUrl}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "upstash-forward-authorization": `Bearer ${ingestKey}`,
      "upstash-retries": String(process.env.QSTASH_RETRIES ?? 3),
    },
    body: JSON.stringify({ agent: agentKey, ...(extra ?? {}) }),
    cache: "no-store",
  });
  return res.ok;
}
