import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConnector } from "@/lib/connectors";
import { getServiceClient } from "@/lib/supabase-server";

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number };

/**
 * Generic OAuth2 callback. Verifies the state cookie, exchanges the code for
 * tokens (Basic or body client auth per connector), and upserts a connection
 * for the signed-in client. Tokens are stored server-only; RLS never exposes
 * them. Token used transiently here, then handed to Supabase (encrypted at rest).
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = new URL(req.url).origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const connector = getConnector(provider);
  if (!connector || !code || !state) return NextResponse.redirect(`${origin}/connections?error=1`);

  // Verify the state cookie set at start.
  const store = await cookies();
  let saved: { state?: string; provider?: string; email?: string } = {};
  try {
    saved = JSON.parse(store.get("ff_connect")?.value ?? "{}");
  } catch {
    /* invalid */
  }
  if (saved.state !== state || saved.provider !== provider || !saved.email) {
    return NextResponse.redirect(`${origin}/connections?error=state`);
  }

  const clientId = process.env[connector.idEnv] as string;
  const clientSecret = process.env[connector.secretEnv] as string;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? origin}/api/connect/${provider}/callback`;

  try {
    const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
    const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
    if (connector.tokenAuth === "basic") {
      headers.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    } else {
      body.set("client_id", clientId);
      body.set("client_secret", clientSecret);
    }

    const tokenRes = await fetch(connector.tokenUrl, { method: "POST", headers, body, cache: "no-store" });
    const token = (await tokenRes.json()) as TokenResponse;
    if (!token.access_token) return NextResponse.redirect(`${origin}/connections?error=token`);

    const supabase = getServiceClient();
    if (supabase) {
      const { data: client } = await supabase.from("clients").select("id").eq("email", saved.email).maybeSingle();
      if (client) {
        const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
        await supabase.from("connections").upsert(
          {
            client_id: client.id,
            provider: connector.name,
            status: "connected",
            scope: connector.scope,
            access_token: token.access_token,
            refresh_token: token.refresh_token ?? null,
            expires_at: expiresAt,
          },
          { onConflict: "client_id,provider" }
        );
      }
    }

    const res = NextResponse.redirect(`${origin}/connections?connected=${provider}`);
    res.cookies.set("ff_connect", "", { maxAge: 0, path: "/" });
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/connections?error=1`);
  }
}
