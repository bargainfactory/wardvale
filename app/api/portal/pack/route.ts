import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { applyPack } from "@/lib/provisioning";
import { entitlement } from "@/lib/agents-catalog";

/**
 * Install a one-click industry pack for the signed-in client: enable the pack's
 * agents (capped by the plan's max) and set the tone/industry. Auth via session.
 */
export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { packId } = (await req.json().catch(() => ({}))) as { packId?: string };
  if (!packId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: client } = await svc
    .from("clients")
    .select("id, plan")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "no_client" }, { status: 400 });

  const ok = await applyPack(client.id, packId, entitlement(client.plan).maxAgents);
  if (!ok) return NextResponse.json({ error: "unknown_pack" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
