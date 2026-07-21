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
  /** Firm rates + quoting rules — the lead-qualifier quotes from these. */
  rateCard?: string | null;
  /** A few past messages the owner wrote, for voice matching (few-shot). */
  voiceSamples?: string[] | null;
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

  const voice = (p.voiceSamples ?? []).map((s) => (s ?? "").trim()).filter(Boolean).slice(0, 5);
  const hasAny = lines.length || p.guardrails?.trim() || p.rateCard?.trim() || voice.length;
  if (!hasAny) return "";

  const parts: string[] = [];
  if (lines.length) {
    parts.push(
      `BUSINESS CONTEXT — write in this business's voice and use only these facts; never invent hours, prices, or policies not stated here:\n${lines.join("\n")}`
    );
  }
  // Rate card / quoting rules — the qualifier quotes from these and treats
  // anything below them (or vague comp like "exposure") as needing a human.
  if (p.rateCard && p.rateCard.trim()) {
    parts.push(
      `RATE CARD & QUOTING RULES — when a message is an offer or asks for pricing, quote from these; flag anything below these rates, paid "in exposure/gifted", or in a prohibited category for the owner instead of accepting:\n${p.rateCard.trim().slice(0, 2000)}`
    );
  }
  // Owner-authored "never do" rules. An instruction, not a hard block —
  // enforcement still relies on the approval gate + policy.
  if (p.guardrails && p.guardrails.trim()) {
    parts.push(`RULES — the owner has instructed you to always follow these; never violate them:\n${p.guardrails.trim().slice(0, 2000)}`);
  }
  // Voice examples — few-shot samples of the owner's real writing so drafts
  // sound like them from message one (before the edit-time learning loop kicks in).
  if (voice.length) {
    const samples = voice.map((s, i) => `Example ${i + 1}:\n${s.slice(0, 800)}`).join("\n\n");
    parts.push(`VOICE EXAMPLES — match the style, tone, and phrasing of these real messages the owner wrote:\n${samples}`);
  }
  return parts.join("\n\n");
}

/** Load + format a client's business context for prompt injection (server-only). */
export async function loadContext(clientId: string): Promise<string> {
  const supabase = getServiceClient();
  if (!supabase) return "";
  const [{ data: client }, { data: prof }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
    supabase
      .from("business_profile")
      .select("industry, hours, services, pricing, faq, tone, guardrails, rate_card, voice_samples")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);
  const row = (prof ?? {}) as Record<string, unknown> & { rate_card?: string | null; voice_samples?: unknown };
  return formatContext({
    name: client?.name,
    ...row,
    rateCard: (row.rate_card as string | null) ?? null,
    voiceSamples: Array.isArray(row.voice_samples) ? (row.voice_samples as string[]) : [],
  });
}
