import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { clientScope } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { encryptSecret, isEncrypted } from "@/lib/crypto";
import { assertPublicHttpsUrl, mcpListTools, hashToolsCache, ToolClientError, type ToolDef } from "@/lib/mcp-client";

// BYOT registration API. A client registers/lists/toggles/deletes their own MCP
// server or HTTPS endpoint. Auth via session email; all writes go through the
// service role, tenant-scoped to the caller's own client. The bearer token is
// stored encrypted (TOKEN_ENC_KEY REQUIRED — never plaintext) in a table with no
// self-read policy. Node runtime (uses node:https/dns via the mcp-client).
export const runtime = "nodejs";

async function resolveClient() {
  const email = await getPortalUserEmail();
  if (!email) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const svc = getServiceClient();
  if (!svc) return { error: NextResponse.json({ error: "not_configured" }, { status: 503 }) };
  const { data: client } = await svc.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!client) return { error: NextResponse.json({ error: "no_client" }, { status: 400 }) };
  return { email, svc, clientId: (client as { id: string }).id };
}

export async function GET() {
  const r = await resolveClient();
  if ("error" in r) return r.error;
  const scope = clientScope(r.svc, r.clientId);
  const { data } = await scope.select("client_tools", "id, label, kind, endpoint, enabled, status, tools_cache, last_error, created_at");
  return NextResponse.json({ tools: data ?? [] });
}

export async function POST(req: Request) {
  const r = await resolveClient();
  if ("error" in r) return r.error;

  const rl = await rateLimit(`tools:${r.clientId}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const body = (await req.json().catch(() => ({}))) as {
    label?: string;
    kind?: "mcp" | "http";
    endpoint?: string;
    token?: string;
  };
  const label = (body.label ?? "").trim().slice(0, 60);
  const kind = body.kind === "http" ? "http" : "mcp";
  const endpoint = (body.endpoint ?? "").trim().slice(0, 2000);
  const token = body.token ? String(body.token).slice(0, 4000) : "";

  if (!label) return NextResponse.json({ error: "label_required" }, { status: 400 });
  try {
    assertPublicHttpsUrl(endpoint);
  } catch (e) {
    return NextResponse.json({ error: e instanceof ToolClientError ? e.code : "bad_endpoint" }, { status: 400 });
  }

  // A bearer token may only be stored encrypted. Refuse rather than persist plaintext.
  let encToken: string | null = null;
  if (token) {
    const enc = encryptSecret(token);
    if (!enc || !isEncrypted(enc)) {
      return NextResponse.json({ error: "secret_storage_unavailable" }, { status: 422 });
    }
    encToken = enc;
  }

  // Discover + cache the tool catalog (mcp), fully guarded. Failures are recorded,
  // not fatal — the owner can fix the endpoint and re-test.
  let toolsCache: ToolDef[] = [];
  let status: "ok" | "error" = "ok";
  let lastError: string | null = null;
  try {
    toolsCache =
      kind === "mcp"
        ? await mcpListTools(endpoint, token || null)
        : [{ name: label, inputSchema: { type: "object", properties: {}, additionalProperties: true } }];
  } catch (e) {
    status = "error";
    lastError = e instanceof ToolClientError ? e.code : "unknown";
  }

  const scope = clientScope(r.svc, r.clientId);
  const { data: row } = await scope
    .upsert(
      "client_tools",
      {
        label,
        kind,
        endpoint,
        auth_scheme: token ? "bearer" : "none",
        status,
        tools_cache: toolsCache,
        cache_hash: hashToolsCache(toolsCache),
        last_error: lastError,
      },
      { onConflict: "client_id,label" }
    )
    .select("id")
    .maybeSingle();

  const toolId = (row as { id?: string } | null)?.id;
  if (toolId && encToken) {
    await scope.upsert("client_tool_secrets", { tool_id: toolId, access_token: encToken }, { onConflict: "tool_id" });
  }
  await scope.insert("agent_audit", { actor: r.email, action: "tool.registered", detail: `${kind}: ${label} (${status})` });

  return NextResponse.json({
    ok: true,
    id: toolId,
    status,
    error: lastError,
    tools: toolsCache.map((t) => ({ name: t.name, description: t.description })),
  });
}

export async function PATCH(req: Request) {
  const r = await resolveClient();
  if ("error" in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; enabled?: boolean };
  if (!body.id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const scope = clientScope(r.svc, r.clientId);
  await scope.update("client_tools", { enabled: Boolean(body.enabled) }).eq("id", body.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const r = await resolveClient();
  if ("error" in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const scope = clientScope(r.svc, r.clientId);
  await scope.delete("client_tools").eq("id", body.id); // cascade removes the secret
  return NextResponse.json({ ok: true });
}
