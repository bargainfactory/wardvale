#!/usr/bin/env node
/**
 * Tenant-scope regression suite (roadmap G9a). Proves the data-access seam always
 * scopes to one client — reads are filtered by client_id, writes have it injected
 * and cannot be overridden. Zero dependencies; exits non-zero on any failure.
 *
 *   node evals/tenant.test.mjs
 *
 * Keep withClientId() / clientScope() below in sync with lib/tenant.ts. A fake
 * Postgrest builder records the chained calls so we can assert what was applied.
 */

// mirror of lib/tenant.ts withClientId (client_id spread LAST → cannot be overridden)
const withClientId = (rows, clientId) =>
  (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, client_id: clientId }));

// records every chained call against a fake supabase client
function recorder() {
  const calls = [];
  const chain = {
    select(columns) { calls.push({ op: "select", columns }); return chain; },
    insert(rows) { calls.push({ op: "insert", rows }); return chain; },
    upsert(rows, options) { calls.push({ op: "upsert", rows, options }); return chain; },
    update(patch) { calls.push({ op: "update", patch }); return chain; },
    delete() { calls.push({ op: "delete" }); return chain; },
    eq(col, val) { calls.push({ op: "eq", col, val }); return chain; },
  };
  return { db: { from(table) { calls.push({ op: "from", table }); return chain; } }, calls };
}

// mirror of lib/tenant.ts clientScope
function clientScope(db, clientId) {
  return {
    select: (table, columns = "*") => db.from(table).select(columns).eq("client_id", clientId),
    insert: (table, rows) => db.from(table).insert(withClientId(rows, clientId)),
    upsert: (table, rows, options) => db.from(table).upsert(withClientId(rows, clientId), options),
    update: (table, patch) => db.from(table).update(patch).eq("client_id", clientId),
    delete: (table) => db.from(table).delete().eq("client_id", clientId),
  };
}

let pass = 0;
let fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
};
const CID = "client-A";
const hasEqClient = (calls) => calls.some((c) => c.op === "eq" && c.col === "client_id" && c.val === CID);

console.log("\nTenant scope — writes inject client_id");
{
  check("single row gets client_id", withClientId({ value: 1 }, CID)[0].client_id === CID);
  check("array rows all get client_id", withClientId([{ a: 1 }, { a: 2 }], CID).every((r) => r.client_id === CID));
  const smuggled = withClientId({ client_id: "OTHER", value: 9 }, CID);
  check("a caller-supplied foreign client_id is overridden", smuggled[0].client_id === CID);
}

console.log("\nTenant scope — reads are pre-filtered");
{
  const { db, calls } = recorder();
  clientScope(db, CID).select("outcomes", "value");
  check("select applies eq client_id", hasEqClient(calls));
  check("select targets the requested table", calls[0].op === "from" && calls[0].table === "outcomes");
}

console.log("\nTenant scope — update & delete are pre-filtered");
{
  const u = recorder();
  clientScope(u.db, CID).update("agent_config", { enabled: false });
  check("update applies eq client_id", hasEqClient(u.calls));

  const d = recorder();
  clientScope(d.db, CID).delete("outcomes");
  check("delete applies eq client_id", hasEqClient(d.calls));
}

console.log("\nTenant scope — insert & upsert carry client_id");
{
  const i = recorder();
  clientScope(i.db, CID).insert("outcomes", { value: 5 });
  const insertCall = i.calls.find((c) => c.op === "insert");
  check("insert payload carries client_id", insertCall.rows[0].client_id === CID);

  const u = recorder();
  clientScope(u.db, CID).upsert("approvals", { summary: "x" }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  const upsertCall = u.calls.find((c) => c.op === "upsert");
  check("upsert payload carries client_id", upsertCall.rows[0].client_id === CID);
  check("upsert forwards its options", upsertCall.options.onConflict === "dedupe_key");
}

console.log(`\n${fail === 0 ? "✓" : "✗"} tenant: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
