import type { SupabaseClient } from "@supabase/supabase-js";

// Governance guardrails the owner controls. Enforced before any auto-send — if a
// policy would be crossed, the action is queued for human approval instead of
// sent. This is what lets regulated verticals (clinics, law) trust auto-send.

export type Policy = {
  dailySpendCap: number | null;
  requireApprovalOver: number | null;
  allowedDomains: string[];
};

const OPEN: Policy = { dailySpendCap: null, requireApprovalOver: null, allowedDomains: [] };

export async function loadPolicy(supabase: SupabaseClient, clientId: string): Promise<Policy> {
  const { data } = await supabase
    .from("client_policy")
    .select("daily_spend_cap, require_approval_over, allowed_domains")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return OPEN;
  return {
    dailySpendCap: data.daily_spend_cap != null ? Number(data.daily_spend_cap) : null,
    requireApprovalOver: data.require_approval_over != null ? Number(data.require_approval_over) : null,
    allowedDomains: (data.allowed_domains ?? "")
      .split(",")
      .map((d: string) => d.trim().toLowerCase())
      .filter(Boolean),
  };
}

/** Total value auto-sent (recorded as outcomes) so far today, for the spend cap. */
export async function spentToday(supabase: SupabaseClient, clientId: string): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("outcomes")
    .select("value")
    .eq("client_id", clientId)
    .gte("created_at", since.toISOString());
  return ((data ?? []) as { value: number }[]).reduce((s, o) => s + (Number(o.value) || 0), 0);
}

/**
 * True if a policy would force this action to approval instead of auto-send.
 * `spentSoFar` is today's running auto-sent total (incl. this run).
 */
export function policyBlocks(
  policy: Policy,
  action: { action: string; to?: string; value?: number },
  spentSoFar: number
): boolean {
  const value = Number(action.value) || 0;
  if (policy.requireApprovalOver != null && value > policy.requireApprovalOver) return true;
  if (policy.dailySpendCap != null && spentSoFar + value > policy.dailySpendCap) return true;
  if (policy.allowedDomains.length && action.action === "email.send" && action.to) {
    const domain = action.to.split("@")[1]?.toLowerCase() ?? "";
    if (!policy.allowedDomains.includes(domain)) return true;
  }
  return false;
}
