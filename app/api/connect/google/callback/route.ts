import { NextResponse } from "next/server";
import { buildInboxPreview } from "@/lib/inbox-preview";

type Header = { name: string; value: string };

/**
 * Gmail OAuth callback. Exchanges the code, reads a small sample of inbox
 * subjects (read-only), builds an automation preview, and stashes it in a
 * short-lived cookie for /connect to render. The token is used transiently and
 * never persisted.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const code = new URL(req.url).searchParams.get("code");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!code || !clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/connect?error=1`);
  }
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? origin}/api/connect/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return NextResponse.redirect(`${origin}/connect?error=1`);

    const auth = { Authorization: `Bearer ${token.access_token}` };
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=12&q=in%3Ainbox",
      { headers: auth }
    );
    const list = (await listRes.json()) as { messages?: { id: string }[] };
    const ids = (list.messages ?? []).slice(0, 10);

    const items: { subject: string; from: string }[] = [];
    for (const m of ids) {
      const mr = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers: auth }
      );
      const md = (await mr.json()) as { payload?: { headers?: Header[] } };
      const headers = md.payload?.headers ?? [];
      const subject = (headers.find((h) => h.name === "Subject")?.value ?? "(no subject)").slice(0, 120);
      const from = (headers.find((h) => h.name === "From")?.value ?? "").slice(0, 80);
      items.push({ subject, from });
    }

    const preview = await buildInboxPreview(items);
    const res = NextResponse.redirect(`${origin}/connect?connected=1`);
    res.cookies.set("ff_inbox_preview", JSON.stringify(preview), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/connect?error=1`);
  }
}
