// Deterministic idempotency key for a proposed agent action.
//
// Two runs that independently propose the SAME action — same client, same agent
// kind, same action type, same external ref, on the same UTC day — produce the
// SAME key. A UNIQUE index on approvals.dedupe_key / outcomes.dedupe_key then
// collapses them via ON CONFLICT DO NOTHING, so an overlapping cron tick + manual
// run can neither double-queue (the owner would otherwise approve twice) nor
// double-send.
//
// The UTC-day bucket is deliberate: a legitimate follow-up cadence (a second
// invoice reminder tomorrow) gets a NEW key and is allowed through, while
// same-day duplicates from racing runs are suppressed.
//
// Keep dedupeKey() in sync with evals/idempotency.test.mjs.

/** UTC calendar day (YYYY-MM-DD) used to bucket the key. */
export function dayBucket(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type DedupeParts = {
  clientId: string;
  kind?: string | null; // agent key (ar-followup, cart-recovery, …); null for the default inbox path
  action: string; // email.send | sms.send | escalate | …
  ref?: string | null; // external ref: invoice #, cart/customer id, email subject
  day?: string; // override the UTC-day bucket (tests); defaults to today
};

/** Build the deterministic dedupe key for an action. */
export function dedupeKey(parts: DedupeParts): string {
  const day = parts.day ?? dayBucket();
  return [
    parts.clientId,
    parts.kind ?? "",
    parts.action,
    (parts.ref ?? "").toLowerCase().trim(),
    day,
  ]
    .join("|")
    .slice(0, 300);
}

/**
 * In-memory model of a Postgres UNIQUE index with ON CONFLICT DO NOTHING.
 * `claim(key)` returns true only the FIRST time a key is seen (mirroring a
 * successful INSERT); false means the row already exists and the duplicate is
 * dropped. Handy as a process-local fast path and used by the idempotency tests.
 */
export function makeLedger() {
  const seen = new Set<string>();
  return {
    claim(key: string): boolean {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    release(key: string): void {
      seen.delete(key);
    },
    has(key: string): boolean {
      return seen.has(key);
    },
    get size(): number {
      return seen.size;
    },
  };
}
