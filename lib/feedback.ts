import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase-server";

// Learning loop: every draft the owner approves (or edits before approving) is a
// signal of what "good" looks like for this business. We store it and feed the
// most recent approved/edited examples back into that agent's prompt — so the
// agent's drafts converge on the owner's voice over time. This compounding
// per-client history is the moat: it doesn't transfer to a competitor.

export async function recordFeedback(
  supabase: SupabaseClient,
  input: { clientId: string; agentKey?: string | null; kind: "approved" | "edited" | "rejected"; sample?: string | null }
): Promise<void> {
  if (!input.agentKey || !input.sample) return;
  try {
    await supabase.from("agent_feedback").insert({
      client_id: input.clientId,
      agent_key: input.agentKey,
      kind: input.kind,
      sample: input.sample.slice(0, 2000),
    });
  } catch {
    /* non-critical */
  }
}

/** Recent approved/edited drafts for an agent, formatted as a few-shot block. */
export async function loadExemplars(clientId: string, agentKey: string, limit = 3): Promise<string> {
  const supabase = getServiceClient();
  if (!supabase || !agentKey) return "";
  const { data } = await supabase
    .from("agent_feedback")
    .select("sample")
    .eq("client_id", clientId)
    .eq("agent_key", agentKey)
    .in("kind", ["approved", "edited"])
    .order("created_at", { ascending: false })
    .limit(limit);
  const samples = ((data ?? []) as { sample: string | null }[]).map((r) => r.sample).filter(Boolean) as string[];
  if (!samples.length) return "";
  return `EXAMPLES THE OWNER APPROVED — match this style, structure, and voice closely:\n${samples
    .map((s, i) => `Example ${i + 1}:\n${s}`)
    .join("\n\n")}`;
}
