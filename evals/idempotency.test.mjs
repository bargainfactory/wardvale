#!/usr/bin/env node
/**
 * Idempotency regression suite. Proves two OVERLAPPING agent runs — e.g. a cron
 * tick racing a manual portal run — cannot double-queue or double-send the SAME
 * action. Zero dependencies; exits non-zero on any failure so it can gate CI.
 *
 *   node evals/idempotency.test.mjs
 *
 * The real guarantee in production is a UNIQUE index on approvals.dedupe_key /
 * outcomes.dedupe_key (supabase/schema.sql) enforcing ON CONFLICT DO NOTHING,
 * plus the runtime's claim-before-send in app/api/agents/run/route.ts. This test
 * models that unique index in memory and the same claim logic, then asserts the
 * exactly-once property.
 *
 * Keep dedupeKey() below in sync with lib/dedupe.ts.
 */

// ── mirror of lib/dedupe.ts (keep in sync) ───────────────────────────────────
const dayBucket = (d) => d.toISOString().slice(0, 10);
const dedupeKey = ({ clientId, kind, action, ref, day }) =>
  [clientId, kind ?? "", action, (ref ?? "").toLowerCase().trim(), day ?? dayBucket(new Date())]
    .join("|")
    .slice(0, 300);

// Model of a Postgres UNIQUE index with ON CONFLICT DO NOTHING.
const makeLedger = () => {
  const seen = new Set();
  return {
    claim: (k) => (seen.has(k) ? false : (seen.add(k), true)), // true == row inserted
    release: (k) => seen.delete(k),
    size: () => seen.size,
  };
};

// ── model of the runtime's persist step (app/api/agents/run/route.ts) ─────────
// Given proposed actions and a shared DB (two ledgers, mirroring the two unique
// indexes), returns how many were newly queued / actually sent this run. `send`
// is a spy that counts real outbound messages; `autoSend` flips the branch.
function persistRun(actions, db, send, { autoSend = false, day } = {}) {
  let queued = 0;
  let sent = 0;
  for (const a of actions) {
    const dkey = dedupeKey({ clientId: a.clientId, kind: a.kind, action: a.action, ref: a.ref, day });
    if (autoSend) {
      // claim-before-send against the outcomes ledger
      if (!db.outcomes.claim(dkey)) continue; // lost the race → suppress, no send
      const ok = send(a); // perform the outbound message
      if (ok) sent += 1;
      else db.outcomes.release(dkey); // failed send → release so a later run retries
    } else {
      // dedup queue insert against the approvals ledger
      if (db.approvals.claim(dkey)) queued += 1; // only new rows count
    }
  }
  return { queued, sent };
}

// ── harness ──────────────────────────────────────────────────────────────────
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

const CID = "client-1";
const DAY = "2026-01-15";
const batch = [
  { clientId: CID, kind: "ar-followup", action: "email.send", ref: "Invoice INV-100" },
  { clientId: CID, kind: "ar-followup", action: "email.send", ref: "Invoice INV-101" },
  { clientId: CID, kind: "ar-followup", action: "escalate", ref: "Invoice INV-102" },
];

console.log("\nIdempotency — overlapping runs cannot double-queue");
{
  const db = { approvals: makeLedger(), outcomes: makeLedger() };
  const r1 = persistRun(batch, db, () => true, { day: DAY });
  const r2 = persistRun(batch, db, () => true, { day: DAY }); // the racing run, same data
  check("run 1 queues all 3 actions", r1.queued === 3);
  check("run 2 (race) queues 0 duplicates", r2.queued === 0);
  check("exactly 3 approval rows total exist", db.approvals.size() === 3);
}

console.log("\nIdempotency — overlapping runs cannot double-send (auto-send on)");
{
  const db = { approvals: makeLedger(), outcomes: makeLedger() };
  let sends = 0;
  const send = () => (sends++, true);
  const emailable = batch.filter((a) => a.action === "email.send");
  const r1 = persistRun(emailable, db, send, { autoSend: true, day: DAY });
  const r2 = persistRun(emailable, db, send, { autoSend: true, day: DAY });
  check("run 1 sends both messages", r1.sent === 2);
  check("run 2 (race) sends nothing", r2.sent === 0);
  check("exactly 2 messages left the building", sends === 2);
}

console.log("\nIdempotency — does not over-collapse legitimate work");
{
  const db = { approvals: makeLedger(), outcomes: makeLedger() };
  // same invoice, but tomorrow → a legitimate follow-up reminder must go through
  persistRun([batch[0]], db, () => true, { day: "2026-01-15" });
  const nextDay = persistRun([batch[0]], db, () => true, { day: "2026-01-16" });
  check("a next-day follow-up is NOT suppressed", nextDay.queued === 1);

  // distinct refs must never be treated as duplicates of each other
  const db2 = { approvals: makeLedger(), outcomes: makeLedger() };
  const distinct = persistRun(batch, db2, () => true, { day: DAY });
  check("three distinct refs all queue independently", distinct.queued === 3);
}

console.log("\nIdempotency — a failed send releases its claim for retry");
{
  const db = { approvals: makeLedger(), outcomes: makeLedger() };
  const one = [batch[0]];
  const r1 = persistRun(one, db, () => false, { autoSend: true, day: DAY }); // send fails
  check("failed send counts as 0 sent", r1.sent === 0);
  check("failed send leaves no lingering claim", db.outcomes.size() === 0);
  const r2 = persistRun(one, db, () => true, { autoSend: true, day: DAY }); // retry succeeds
  check("a later run can retry the released action", r2.sent === 1);
}

console.log(`\n${fail === 0 ? "✓" : "✗"} idempotency: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
