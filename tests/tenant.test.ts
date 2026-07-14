import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientScope, withClientId } from "@/lib/tenant";

type Call = { op: string; [k: string]: unknown };

// A fake Postgrest builder that records the chained calls, so we can assert what
// the seam applied. clientScope only needs a `.from()` returning this chain.
function recorder() {
  const calls: Call[] = [];
  const chain = {
    select: (columns?: string) => (calls.push({ op: "select", columns }), chain),
    insert: (rows: unknown) => (calls.push({ op: "insert", rows }), chain),
    upsert: (rows: unknown, options?: unknown) => (calls.push({ op: "upsert", rows, options }), chain),
    update: (patch: unknown) => (calls.push({ op: "update", patch }), chain),
    delete: () => (calls.push({ op: "delete" }), chain),
    eq: (col: string, val: unknown) => (calls.push({ op: "eq", col, val }), chain),
  };
  const db = { from: (table: string) => (calls.push({ op: "from", table }), chain) };
  return { db: db as unknown as SupabaseClient, calls };
}
const eqClient = (calls: Call[], cid: string) => calls.some((c) => c.op === "eq" && c.col === "client_id" && c.val === cid);
const firstRow = (rows: unknown) => (rows as Record<string, unknown>[])[0];

describe("withClientId", () => {
  it("injects client_id into a single row and into arrays", () => {
    expect(withClientId({ v: 1 }, "A")[0].client_id).toBe("A");
    expect(withClientId([{}, {}], "A").every((r) => r.client_id === "A")).toBe(true);
  });

  it("overrides a caller-supplied foreign client_id (cannot be smuggled)", () => {
    expect(withClientId({ client_id: "OTHER", v: 1 }, "A")[0].client_id).toBe("A");
  });
});

describe("clientScope", () => {
  it("pre-filters select / update / delete by client_id", () => {
    const s = recorder();
    clientScope(s.db, "A").select("outcomes", "value");
    expect(eqClient(s.calls, "A")).toBe(true);

    const u = recorder();
    clientScope(u.db, "A").update("agent_config", { enabled: false });
    expect(eqClient(u.calls, "A")).toBe(true);

    const d = recorder();
    clientScope(d.db, "A").delete("outcomes");
    expect(eqClient(d.calls, "A")).toBe(true);
  });

  it("injects client_id on insert and upsert, forwarding upsert options", () => {
    const i = recorder();
    clientScope(i.db, "A").insert("outcomes", { value: 5 });
    expect(firstRow(i.calls.find((c) => c.op === "insert")!.rows).client_id).toBe("A");

    const u = recorder();
    clientScope(u.db, "A").upsert("approvals", { s: 1 }, { onConflict: "dedupe_key", ignoreDuplicates: true });
    const call = u.calls.find((c) => c.op === "upsert")!;
    expect(firstRow(call.rows).client_id).toBe("A");
    expect((call.options as { onConflict: string }).onConflict).toBe("dedupe_key");
  });
});
