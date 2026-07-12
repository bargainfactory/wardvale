import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Rotate the signed-in client's ingest key (the bearer secret that authenticates
 * external agent runs). Invalidates the old key immediately; returns the new one
 * ONCE for the owner to copy. Rate-limited to blunt abuse.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`rotatekey:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: client } = await svc.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!client) return NextResponse.json({ error: "no_client" }, { status: 400 });

  const newKey = randomBytes(24).toString("hex");
  await svc.from("clients").update({ ingest_key: newKey }).eq("id", client.id);
  await svc.from("agent_audit").insert({
    client_id: client.id,
    actor: email,
    action: "ingest_key.rotated",
    detail: "Rotated the ingestion API key",
  });

  return NextResponse.json({ ok: true, key: newKey });
}
