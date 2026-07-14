import type { SupabaseClient } from "@supabase/supabase-js";
import { clientScope } from "@/lib/tenant";

// Closed-loop ROI: every executed action with dollars at stake becomes a
// 'pending' outcome (pipeline). It resolves to 'won' (realized $) automatically
// where we can observe it, or when the owner confirms. This is the proof dataset
// that turns "tasks run" into "$ we made you".

// Per-action-type resolution windows (roadmap U4a): how long a still-present
// item must persist before we treat "gone" as a real conversion. Fast-moving
// funnels (abandoned carts) resolve sooner; slow ones (overdue invoices) need
// longer, or a single partial pull produces false "won"s. A per-tenant value can
// be threaded through `graceForKind`'s override argument.
export const GRACE_BY_KIND: Record<string, number> = {
  "cart-recovery": 6 * 60 * 60 * 1000, // 6h
  "lead-qualification": 12 * 60 * 60 * 1000, // 12h
  "ar-followup": 24 * 60 * 60 * 1000, // 24h
  "review-request": 3 * 24 * 60 * 60 * 1000, // 3d
};
const DEFAULT_GRACE_MS = 12 * 60 * 60 * 1000;

/** Resolution grace for an action type; a valid explicit override (e.g. per-tenant) wins. */
export function graceForKind(kind: string | null | undefined, overrideMs?: number | null): number {
  if (overrideMs != null && Number.isFinite(overrideMs) && overrideMs >= 0) return overrideMs;
  return (kind ? GRACE_BY_KIND[kind] : undefined) ?? DEFAULT_GRACE_MS;
}

/**
 * Automatic resolution: when we re-pull a source (overdue invoices, abandoned
 * carts) and a previously-actioned item is GONE, it resolved in our favor — the
 * invoice got paid, the cart converted — so we flip that pending outcome to
 * 'won'. The grace period (per action type) avoids false positives from a single
 * partial pull. This is what makes the ROI story self-proving, not owner-confirmed.
 */
export async function resolveOutcomes(
  supabase: SupabaseClient,
  clientId: string,
  kind: string,
  presentRefs: string[],
  graceMs?: number
): Promise<number> {
  const cutoff = new Date(Date.now() - graceForKind(kind, graceMs)).toISOString();
  const scope = clientScope(supabase, clientId);
  const { data } = await scope
    .select("outcomes", "id, ref")
    .eq("kind", kind)
    .eq("status", "pending")
    .lt("created_at", cutoff);
  const present = new Set(presentRefs.filter(Boolean));
  const won = ((data ?? []) as { id: string; ref: string | null }[]).filter((o) => o.ref && !present.has(o.ref)).map((o) => o.id);
  if (won.length) {
    await scope.update("outcomes", { status: "won", resolved_at: new Date().toISOString() }).in("id", won);
  }
  return won.length;
}

export async function recordOutcome(
  supabase: SupabaseClient,
  input: {
    clientId: string;
    approvalId?: string | null;
    agent?: string | null;
    action?: string | null;
    kind?: string | null;
    value?: number | null;
    detail?: string | null;
    ref?: string | null;
  }
): Promise<void> {
  const value = Number(input.value) || 0;
  if (value <= 0) return; // only track actions with real money at stake
  try {
    await clientScope(supabase, input.clientId).insert("outcomes", {
      // client_id injected by the scope
      approval_id: input.approvalId ?? null,
      agent: input.agent ?? null,
      action: input.action ?? null,
      kind: input.kind ?? null,
      value,
      detail: input.detail ?? null,
      ref: input.ref ?? null,
      status: "pending",
    });
  } catch {
    /* non-critical — never fail the action because attribution logging hiccuped */
  }
}
