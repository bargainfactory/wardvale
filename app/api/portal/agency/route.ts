import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { provisionClient } from "@/lib/provisioning";
import { getAgencyFor } from "@/lib/agency";

/**
 * Agency console API. "create" registers the signed-in user as an agency;
 * "add-client" provisions a fully set-up client under that agency.
 */
export async function POST(req: Request) {
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
