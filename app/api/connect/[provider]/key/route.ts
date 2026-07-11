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
  const fields = connector.keyFields ?? [{ name: "key", label: "API key" }];
  const creds: Record<string, string> = {};
  for (const f of fields) {
    const v = (form?.get(f.name) ?? "").toString().trim();
    if (v) creds[f.name] = v;
  }
  if (!creds.key) return NextResponse.redirect(`${origin}/connections?error=key&p=${provider}`, { status: 303 });

  // Store the full credential set as JSON in the (server-only) token column so
  // multi-part keys (e.g. Twilio SID + auth token + from number) round-trip.
  // external_id holds the public identifier for display.
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
          access_token: JSON.stringify(creds),
          refresh_token: null,
          expires_at: null,
          external_id: creds.key,
        },
        { onConflict: "client_id,provider" }
      );
    }
  }

  return NextResponse.redirect(`${origin}/connections?connected=${provider}`, { status: 303 });
}
