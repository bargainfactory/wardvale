import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { clientScope } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { validateArgs, type MCPSchema } from "@/lib/mcp";

// Queue a BYOT tool call for approval. This is the owner-initiated proposer:
// it creates a PENDING approval (never executes here) that runs through the same
// guarded, capped executor in /api/portal/approvals/decide on approval. Args are
// validated against the cached schema up front so bad calls fail fast.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const { data: client } = await svc.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!client) return NextResponse.json({ error: "no_client" }, { status: 400 });
  const clientId = (client as { id: string }).id;

  const rl = await rateLimit(`tool:${clientId}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const body = (await req.json().catch(() => ({}))) as { toolId?: string; toolName?: string; args?: Record<string, unknown> };
  const args = (body.args ?? {}) as Record<string, unknown>;
  if (!body.toolId || !body.toolName) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const scope = clientScope(svc, clientId);
  const { data: tool } = await scope.select("client_tools", "id, enabled, status, tools_cache").eq("id", body.toolId).maybeSingle();
  const tl = tool as { id: string; enabled: boolean; status: string; tools_cache: { name?: string; inputSchema?: MCPSchema }[] | null } | null;
  if (!tl || !tl.enabled || tl.status !== "ok") return NextResponse.json({ error: "tool_unavailable" }, { status: 400 });

  const entry = (tl.tools_cache ?? []).find((c) => c?.name === body.toolName);
  if (!entry) return NextResponse.json({ error: "unknown_tool" }, { status: 400 });
  if (entry.inputSchema) {
    const invalid = validateArgs(entry.inputSchema, args);
    if (invalid) return NextResponse.json({ error: "bad_args", detail: invalid }, { status: 400 });
  }

  await scope.insert("approvals", {
    agent: "byot",
    action: "tool.call",
    summary: `Call tool: ${body.toolName}`,
    status: "pending",
    dedupe_key: `tool.call:${tl.id}:${randomUUID()}`,
    payload: { tool_id: tl.id, tool_name: body.toolName, args, kind: "byot" },
  });

  return NextResponse.json({ ok: true, queued: true });
}
