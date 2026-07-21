import { getServiceClient } from "@/lib/supabase-server";
import type { ConfigPlan } from "@/lib/studio-generator";

// Server-only applier for the Agent Design Studio. Kept separate from the pure
// `lib/studio-generator.ts` so the generator can be imported into the client for
// the live review preview without pulling in the service-role client.

/**
 * Apply a plan to live config. Impure — writes via the service role, scoped to
 * one client. Reuses applyPack's write shape: update agent_config per key, upsert
 * business_profile (the studio is the single last writer for these facts), and
 * upsert client_policy only when it carries a real value (never a needless OPEN
 * row, never clobbering a manual policy with nulls). Runs only on explicit Apply.
 */
export async function applyConfigPlan(clientId: string, plan: ConfigPlan): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase) return false;

  for (const a of plan.agents) {
    await supabase
      .from("agent_config")
      .update({ enabled: a.enabled, auto_send: a.autoSend, schedule: a.schedule })
      .eq("client_id", clientId)
      .eq("agent_key", a.key);
  }

  await supabase.from("business_profile").upsert(
    {
      client_id: clientId,
      industry: plan.profile.industry,
      tone: plan.profile.tone ?? "friendly and professional",
      hours: plan.profile.hours,
      services: plan.profile.services,
      pricing: plan.profile.pricing,
      faq: plan.profile.faq,
      guardrails: plan.profile.guardrails,
      rate_card: plan.profile.rateCard,
      voice_samples: plan.profile.voiceSamples,
      intake: plan.intake,
    },
    { onConflict: "client_id" }
  );

  const p = plan.policy;
  if (p.dailySpendCap != null || p.requireApprovalOver != null || p.allowedDomains != null) {
    await supabase.from("client_policy").upsert(
      {
        client_id: clientId,
        daily_spend_cap: p.dailySpendCap,
        require_approval_over: p.requireApprovalOver,
        allowed_domains: p.allowedDomains,
      },
      { onConflict: "client_id" }
    );
  }

  await supabase.from("agent_audit").insert({
    client_id: clientId,
    actor: "studio",
    action: "studio.applied",
    detail: plan.rationale.join(" ").slice(0, 500),
  });

  return true;
}
