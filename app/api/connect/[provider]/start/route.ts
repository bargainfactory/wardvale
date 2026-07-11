import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { getConnector, isConnectorConfigured } from "@/lib/connectors";
import { getPortalUserEmail } from "@/lib/supabase-ssr";

const b64url = (buf: Buffer) => buf.toString("base64url");

/**
 * Generic OAuth2 authorization-code start for any registered connector.
 * Requires a signed-in portal user (so the connection binds to their client),
 * stashes a signed state in an httpOnly cookie, and redirects to the provider.
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = new URL(req.url).origin;

  const connector = getConnector(provider);
  if (!connector) return NextResponse.redirect(`${origin}/connections?error=unknown`);
  if (!isConnectorConfigured(connector)) {
    return NextResponse.redirect(`${origin}/connections?error=notconfigured&p=${provider}`);
  }

  const email = await getPortalUserEmail();
  if (!email) return NextResponse.redirect(`${origin}/portal/login`);

  const state = crypto.randomUUID();
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? origin}/api/connect/${provider}/callback`;

  // PKCE (S256) for providers that require it (e.g. Klaviyo). The verifier is
  // kept server-side in the state cookie and replayed at token exchange.
  const verifier = connector.pkce ? b64url(randomBytes(32)) : undefined;

  const authUrl = new URL(connector.authUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", process.env[connector.idEnv] as string);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  if (connector.scope) authUrl.searchParams.set("scope", connector.scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  if (verifier) {
    authUrl.searchParams.set("code_challenge", b64url(createHash("sha256").update(verifier).digest()));
    authUrl.searchParams.set("code_challenge_method", "S256");
  }

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("ff_connect", JSON.stringify({ state, provider, email, verifier }), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
