import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Save the signed-in client's business profile (the context injected into every
 * agent prompt). Optionally marks onboarding complete. Auth via session; writes
 * with the service role scoped to the caller's own client.
 */
export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    industry?: string;
    hours?: string;
    services?: string;
    pricing?: string;
    faq?: string;
    tone?: string;
    timezone?: string;
    finish?: boolean;
  };

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: client } = await svc.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!client) return NextResponse.json({ error: "no_client" }, { status: 400 });

  const trim = (v: string | undefined, n: number) => (v ?? "").toString().slice(0, n) || null;
  await svc.from("business_profile").upsert(
    {
      client_id: client.id,
      industry: trim(body.industry, 120),
      hours: trim(body.hours, 300),
      services: trim(body.services, 1000),
      pricing: trim(body.pricing, 1000),
      faq: trim(body.faq, 3000),
      tone: trim(body.tone, 200) ?? "friendly and professional",
    },
    { onConflict: "client_id" }
  );

  const patch: Record<string, unknown> = {};
  if (body.timezone) patch.timezone = body.timezone.slice(0, 60);
  if (body.finish) patch.onboarded = true;
  if (Object.keys(patch).length) await svc.from("clients").update(patch).eq("id", client.id);

  await svc.from("agent_audit").insert({
    client_id: client.id,
    actor: email,
    action: "config.updated",
    detail: body.finish ? "Completed onboarding" : "Updated business profile",
  });

  return NextResponse.json({ ok: true });
}
