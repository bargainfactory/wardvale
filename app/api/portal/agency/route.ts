import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { provisionClient } from "@/lib/provisioning";
import { getAgencyFor } from "@/lib/agency";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Agency console API. "create" registers the signed-in user as an agency;
 * "add-client" provisions a fully set-up client under that agency.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`agency:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    name?: string;
    brandColor?: string;
    clientEmail?: string;
    clientName?: string;
  };

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  if (body.action === "create") {
    if (!body.name) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    await svc.from("agencies").upsert(
      {
        owner_email: email.toLowerCase(),
        name: body.name.slice(0, 120),
        brand_color: (body.brandColor || "#22d3ee").slice(0, 20),
      },
      { onConflict: "owner_email" }
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "add-client") {
    const agency = await getAgencyFor(email);
    if (!agency) return NextResponse.json({ error: "no_agency" }, { status: 400 });
    if (!body.clientEmail) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    // Prevent tenant hijack: an agency may only provision a BRAND-NEW client, never
    // re-parent an account that already exists (which provisionClient's "existing"
    // branch would silently do, reassigning another tenant's agency_id + name).
    // Joining an existing account to an agency must go through a consent/invite flow.
    const { data: existingClient, error: lookupErr } = await svc
      .from("clients")
      .select("id")
      .eq("email", body.clientEmail.toLowerCase())
      .maybeSingle();
    // Fail CLOSED if the existence check itself errors — a transient DB error must
    // not bypass the guard and let provisionClient re-parent an existing account.
    if (lookupErr) return NextResponse.json({ error: "lookup_failed" }, { status: 503 });
    if (existingClient) return NextResponse.json({ error: "client_exists" }, { status: 409 });
    const created = await provisionClient({
      email: body.clientEmail,
      name: body.clientName,
      agencyId: agency.id,
      supabase: svc,
    });
    if (!created) return NextResponse.json({ error: "provision_failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
