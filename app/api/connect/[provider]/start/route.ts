import { NextResponse } from "next/server";
import { getConnector, isConnectorConfigured } from "@/lib/connectors";
import { getPortalUserEmail } from "@/lib/supabase-ssr";

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

  const authUrl = new URL(connector.authUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", process.env[connector.idEnv] as string);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", connector.scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("ff_connect", JSON.stringify({ state, provider, email }), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
