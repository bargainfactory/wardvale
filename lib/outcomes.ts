import type { SupabaseClient } from "@supabase/supabase-js";

// Closed-loop ROI: every executed action with dollars at stake becomes a
// 'pending' outcome (pipeline). It resolves to 'won' (realized $) automatically
// where we can observe it, or when the owner confirms. This is the proof dataset
// that turns "tasks run" into "$ we made you".

/**
 * Automatic resolution: when we re-pull a source (overdue invoices, abandoned
 * carts) and a previously-actioned item is GONE, it resolved in our favor — the
 * invoice got paid, the cart converted — so we flip that pending outcome to
 * 'won'. A grace period avoids false positives from a single partial pull. This
 * is what makes the ROI story self-proving instead of owner-confirmed.
 */
export async function resolveOutcomes(
  supabase: SupabaseClient,
  clientId: string,
  kind: string,
  presentRefs: string[],
  graceMs = 12 * 60 * 60 * 1000
): Promise<number> {
  const cutoff = new Date(Date.now() - graceMs).toISOString();
  const { data } = await supabase
    .from("outcomes")
    .select("id, ref")
    .eq("client_id", clientId)
    .eq("kind", kind)
    .eq("status", "pending")
    .lt("created_at", cutoff);
  const present = new Set(presentRefs.filter(Boolean));
  const won = ((data ?? []) as { id: string; ref: string | null }[]).filter((o) => o.ref && !present.has(o.ref)).map((o) => o.id);
  if (won.length) {
    await supabase.from("outcomes").update({ status: "won", resolved_at: new Date().toISOString() }).in("id", won);
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
    await supabase.from("outcomes").insert({
      client_id: input.clientId,
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
