import type { SupabaseClient } from "@supabase/supabase-js";

// ── Tenant-scoped data access (roadmap G9a) ──────────────────────────────────
// The service-role client bypasses RLS, so cross-tenant safety depends on every
// query remembering its `client_id` filter — one forgotten `.eq("client_id", …)`
// leaks one customer's data to another. clientScope() removes that footgun: it
// hands out a builder that is ALREADY filtered to one client for reads and
// injects the client_id on writes, so an unscoped query is impossible to write.
// Use it for all service-role access to client-scoped tables.

/** Tables that carry a client_id and must always be queried within one tenant. */
export type ScopedTable =
  | "approvals"
  | "outcomes"
  | "agent_audit"
  | "agent_config"
  | "business_profile"
  | "client_policy"
  | "connections"
  | "agent_feedback";

type Row = Record<string, unknown>;

/**
 * Force `client_id` onto a row (or rows). The spread puts client_id LAST so a
 * caller can't override it — even `withClientId({ client_id: "other" }, id)`
 * yields `id`. Exported for the seam's tests.
 */
export function withClientId(rows: Row | Row[], clientId: string): (Row & { client_id: string })[] {
  return (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, client_id: clientId }));
}

// Minimal Postgrest builder surface. We intentionally erase supabase-js's heavy
// generic result inference here: the seam's job is the RUNTIME client_id scoping
// (callers cast row shapes as they already did), and the fully-typed builder over
// a union of tables makes type-checking explode. Chaining (.eq/.gte/.in/.order/
// .maybeSingle …) still works — the result is just untyped, as before.
/* eslint-disable @typescript-eslint/no-explicit-any */
type LooseBuilder = {
  select: (columns?: string) => any;
  insert: (rows: unknown) => any;
  upsert: (rows: unknown, options?: unknown) => any;
  update: (patch: unknown) => any;
  delete: () => any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * A data-access seam bound to ONE client. Reads come pre-filtered by client_id;
 * writes get client_id injected. You can keep chaining as usual — you just can
 * never obtain a builder that isn't scoped to this client.
 */
export function clientScope(db: SupabaseClient, clientId: string) {
  const from = (table: ScopedTable): LooseBuilder =>
    (db as unknown as { from: (t: string) => LooseBuilder }).from(table);
  return {
    clientId,
    /** SELECT pre-filtered to this client. */
    select(table: ScopedTable, columns = "*") {
      return from(table).select(columns).eq("client_id", clientId);
    },
    /** INSERT with client_id injected into every row. */
    insert(table: ScopedTable, rows: Row | Row[]) {
      return from(table).insert(withClientId(rows, clientId));
    },
    /** UPSERT with client_id injected; pass onConflict/ignoreDuplicates as usual. */
    upsert(table: ScopedTable, rows: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
      return from(table).upsert(withClientId(rows, clientId), options);
    },
    /** UPDATE pre-filtered to this client. */
    update(table: ScopedTable, patch: Row) {
      return from(table).update(patch).eq("client_id", clientId);
    },
    /** DELETE pre-filtered to this client. */
    delete(table: ScopedTable) {
      return from(table).delete().eq("client_id", clientId);
    },
  };
}

export type ClientScope = ReturnType<typeof clientScope>;
