import { getServiceClient } from "@/lib/supabase-server";

export type LeadInput = {
  name?: string;
  email?: string;
  businessType?: string;
  painPoints?: string;
  source: "quote" | "audit" | "workflow";
  metadata?: Record<string, unknown>;
};

/**
 * Best-effort lead capture. Persists to the `leads` table when Supabase is
 * configured; silently no-ops otherwise so the lead-gen flow never breaks on
 * a missing integration. Failures are logged, not thrown.
 */
export async function saveLead(lead: LeadInput): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;
  try {
    const { error } = await supabase.from("leads").insert({
      name: lead.name?.trim() || null,
      email: lead.email?.trim().toLowerCase() || null,
      business_type: lead.businessType?.trim() || null,
      pain_points: lead.painPoints?.trim() || null,
      source: lead.source,
      metadata: lead.metadata ?? {},
    });
    if (error) console.error("saveLead insert error:", error.message);
  } catch (err) {
    console.error("saveLead failed:", err);
  }
}
