import type { SupabaseClient } from "@supabase/supabase-js";

// Closed-loop ROI: every executed action with dollars at stake becomes a
// 'pending' outcome (pipeline). It resolves to 'won' (realized $) automatically
// where we can observe it, or when the owner confirms. This is the proof dataset
// that turns "tasks run" into "$ we made you".

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
