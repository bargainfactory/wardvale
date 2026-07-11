import { NextResponse } from "next/server";

/** Begins the Gmail read-only OAuth flow (or bounces back if unconfigured). */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${origin}/connect?error=notconfigured`);
  }
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? origin}/api/connect/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "consent",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
