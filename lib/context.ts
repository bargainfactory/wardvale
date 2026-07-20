import { getServiceClient } from "@/lib/supabase-server";

// The business's own facts, formatted into a prompt block that's prepended to
// every agent's system prompt so drafts are accurate + in-voice without any
// custom engineering per client.

export type Profile = {
  name?: string | null;
  industry?: string | null;
  hours?: string | null;
  services?: string | null;
  pricing?: string | null;
  faq?: string | null;
  tone?: string | null;
  guardrails?: string | null;
};

export function formatContext(p: Profile | null | undefined): string {
  if (!p) return "";
  const lines: string[] = [];
  if (p.name) lines.push(`Business: ${p.name}`);
  if (p.industry) lines.push(`Industry: ${p.industry}`);
  if (p.hours) lines.push(`Hours: ${p.hours}`);
  if (p.services) lines.push(`Services/products: ${p.services}`);
  if (p.pricing) lines.push(`Pricing: ${p.pricing}`);
  if (p.faq) lines.push(`Known answers / FAQ: ${p.faq}`);
  if (p.tone) lines.push(`Preferred tone: ${p.tone}`);
  if (!lines.length && !p.guardrails) return "";
  const block = lines.length
    ? `BUSINESS CONTEXT — write in this business's voice and use only these facts; never invent hours, prices, or policies not stated here:\n${lines.join("\n")}`
    : "";
  // Owner-authored "never do" rules. Appended as an instruction, not a hard
  // block — the model is told to obey these; enforcement still relies on the
  // approval gate + policy. Trimmed defensively to bound prompt size.
  if (p.guardrails && p.guardrails.trim()) {
    const rules = `RULES — the owner has instructed you to always follow these; never violate them:\n${p.guardrails.trim().slice(0, 2000)}`;
    return block ? `${block}\n\n${rules}` : rules;
  }
  return block;
}

/** Load + format a client's business context for prompt injection (server-only). */
export async function loadContext(clientId: string): Promise<string> {
  const supabase = getServiceClient();
  if (!supabase) return "";
  const [{ data: client }, { data: prof }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
    supabase
      .from("business_profile")
      .select("industry, hours, services, pricing, faq, tone, guardrails")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);
  return formatContext({ name: client?.name, ...(prof ?? {}) });
}
