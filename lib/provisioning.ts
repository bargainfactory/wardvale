import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase-server";
import { AGENTS, getPack, type AgentKey } from "@/lib/agents-catalog";

// Self-serve provisioning: turn a sign-up or a Stripe checkout into a fully
// set-up client — ingest key, a business-profile row, and one agent_config row
// per catalog agent — so the account is live without any manual seeding.

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "there";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// New accounts start with inbox triage on (every business has email) and the
// rest present-but-off, ready to enable in onboarding or via a pack.
const DEFAULT_ON: AgentKey[] = ["inbox-triage"];

/**
 * Idempotently provision a client for an email. Creates or updates the client
 * (plan/status/stripe id), ensures a business_profile, and seeds agent_config
 * for every catalog agent. Returns the client id + ingest key, or null if
 * Supabase isn't configured.
 */
export async function provisionClient(input: {
  email: string;
  name?: string;
  plan?: string;
  status?: string;
  stripeCustomerId?: string | null;
  supabase?: SupabaseClient;
}): Promise<{ id: string; ingest_key: string } | null> {
  const supabase = input.supabase ?? getServiceClient();
  if (!supabase) return null;
  const email = input.email.toLowerCase();

  const { data: existing } = await supabase
    .from("clients")
    .select("id, ingest_key")
    .eq("email", email)
    .maybeSingle();

  let clientId: string;
  let ingestKey: string;

  if (existing) {
    clientId = existing.id;
    ingestKey = existing.ingest_key;
    const patch: Record<string, unknown> = {};
    if (input.plan) patch.plan = input.plan;
    if (input.status) patch.status = input.status;
    if (input.stripeCustomerId) patch.stripe_customer_id = input.stripeCustomerId;
    if (input.name) patch.name = input.name;
    if (Object.keys(patch).length) await supabase.from("clients").update(patch).eq("id", clientId);
  } else {
    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        email,
        name: input.name || nameFromEmail(email),
        plan: input.plan ?? "trial",
        status: input.status ?? "active",
        tier: input.plan ?? "trial",
        stripe_customer_id: input.stripeCustomerId ?? null,
      })
      .select("id, ingest_key")
      .single();
    if (error || !created) return null;
    clientId = created.id;
    ingestKey = created.ingest_key;
  }

  // Ensure a business-profile row exists (empty until onboarding fills it).
  await supabase.from("business_profile").upsert({ client_id: clientId }, { onConflict: "client_id" });

  // Seed one agent_config per catalog agent if not already present.
  const { data: haveConfigs } = await supabase.from("agent_config").select("agent_key").eq("client_id", clientId);
  const present = new Set((haveConfigs ?? []).map((r: { agent_key: string }) => r.agent_key));
  const toInsert = AGENTS.filter((a) => !present.has(a.key)).map((a) => ({
    client_id: clientId,
    agent_key: a.key,
    enabled: DEFAULT_ON.includes(a.key),
    auto_send: false,
    schedule: "manual",
  }));
  if (toInsert.length) await supabase.from("agent_config").insert(toInsert);

  return { id: clientId, ingest_key: ingestKey };
}

/** JIT: ensure a signed-in user has a client (trial) the first time they land. */
export async function ensureClientProvisioned(email: string): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;
  const { data } = await supabase.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!data) await provisionClient({ email, supabase });
}

/**
 * Apply an industry pack: enable its agents (respecting the plan's max is done
 * in the UI/route), set the profile tone, and record the industry. Connectors
 * are surfaced as recommendations in onboarding, not force-connected.
 */
export async function applyPack(clientId: string, packId: string): Promise<boolean> {
  const supabase = getServiceClient();
  const pack = getPack(packId);
  if (!supabase || !pack) return false;

  // Enable the pack's agents, disable the rest — a clean, predictable install.
  for (const a of AGENTS) {
    await supabase
      .from("agent_config")
      .update({ enabled: pack.agents.includes(a.key) })
      .eq("client_id", clientId)
      .eq("agent_key", a.key);
  }
  await supabase.from("business_profile").upsert(
    { client_id: clientId, industry: pack.industry, tone: pack.tone },
    { onConflict: "client_id" }
  );
  await supabase.from("agent_audit").insert({
    client_id: clientId,
    actor: "system",
    action: "pack.installed",
    detail: `${pack.name} — ${pack.agents.length} agents enabled`,
  });
  return true;
}
