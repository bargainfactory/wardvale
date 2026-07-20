import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { assertPublicHttpsUrl, mcpListTools, ToolClientError } from "@/lib/mcp-client";

// "Test connection" for the BYOT add-a-tool form: runs the FULL guarded path
// (SSRF/timeout/size) against a candidate endpoint and returns the discovered
// tools, WITHOUT persisting anything. The test button is itself an SSRF vector,
// so it never bypasses the guards. Node runtime.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Rate-limit by IP (the caller's client is authed but the risk here is outbound abuse).
  const rl = await rateLimit(`tools-test:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  // Confirm the caller actually has a client (defense in depth).
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const { data: client } = await svc.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!client) return NextResponse.json({ error: "no_client" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { kind?: "mcp" | "http"; endpoint?: string; token?: string };
  const kind = body.kind === "http" ? "http" : "mcp";
  const endpoint = (body.endpoint ?? "").trim().slice(0, 2000);
  const token = body.token ? String(body.token).slice(0, 4000) : "";

  try {
    assertPublicHttpsUrl(endpoint);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof ToolClientError ? e.code : "bad_endpoint" });
  }

  if (kind === "http") {
    // Nothing safe to POST blindly; the URL passed the guard and the runtime call
    // is fully validated again. Report reachable-format success.
    return NextResponse.json({ ok: true, tools: [] });
  }

  try {
    const tools = await mcpListTools(endpoint, token || null);
    return NextResponse.json({ ok: true, tools: tools.map((t) => ({ name: t.name, description: t.description })) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof ToolClientError ? e.code : "unknown" });
  }
}
