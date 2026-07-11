import { NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors";
import { getServiceClient } from "@/lib/supabase-server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";

/**
 * Connect an API-key provider (Twilio, Stripe, Yelp). Unlike OAuth, there's no
 * redirect dance — the signed-in client pastes their own credential and we store
 * it as the connection's token (server-only; RLS never exposes it). For two-part
 * credentials (e.g. Twilio SID + auth token) the secret is the auth credential
 * and the public id is kept in external_id.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = new URL(req.url).origin;

  const connector = getConnector(provider);
  if (!connector || connector.tokenAuth !== "apikey") {
    return NextResponse.redirect(`${origin}/connections?error=unknown`, { status: 303 });
  }

  const email = await getPortalUserEmail();
  if (!email) return NextResponse.redirect(`${origin}/portal/login`, { status: 303 });

  const form = await req.formData().catch(() => null);
  const key = (form?.get("key") ?? "").toString().trim();
  const secret = (form?.get("secret") ?? "").toString().trim();
  if (!key) return NextResponse.redirect(`${origin}/connections?error=key&p=${provider}`, { status: 303 });

  // When both are supplied, `key` is the public id and `secret` is the credential.
  const token = secret || key;
  const publicId = secret ? key : null;

  const supabase = getServiceClient();
  if (supabase) {
    const { data: client } = await supabase.from("clients").select("id").eq("email", email).maybeSingle();
    if (client) {
      await supabase.from("connections").upsert(
        {
          client_id: client.id,
          provider: connector.name,
          status: "connected",
          scope: "apikey",
          access_token: token,
          refresh_token: null,
          expires_at: null,
          external_id: publicId,
        },
        { onConflict: "client_id,provider" }
      );
    }
  }

  return NextResponse.redirect(`${origin}/connections?connected=${provider}`, { status: 303 });
}
