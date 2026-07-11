import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Authenticated portal trigger: a signed-in client runs one agent cycle on their
 * OWN live data. We resolve the client from their session, look up their
 * server-only ingest key, and replay it to /api/agents/run — which pulls live
 * data from their connected tools and persists the approval-gated actions. The
 * key never touches the browser.
 */
export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { agent } = (await req.json().catch(() => ({}))) as { agent?: string };
  if (!agent) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: client } = await svc
    .from("clients")
    .select("ingest_key")
    .eq("email", email)
    .maybeSingle();
  if (!client?.ingest_key) return NextResponse.json({ error: "no_client" }, { status: 400 });

  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/agents/run`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${client.ingest_key}` },
    body: JSON.stringify({ agent }),
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { "content-type": "application/json" } });
}
