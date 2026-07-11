import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { entitlement, scheduleAllowed, isAgentKey, type Schedule } from "@/lib/agents-catalog";

/**
 * Update one agent's config for the signed-in client — enabled, auto-send, or
 * schedule — with plan entitlements enforced server-side (max enabled agents +
 * allowed cadences). Auth via session.
 */
export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    agentKey?: string;
    enabled?: boolean;
    autoSend?: boolean;
    schedule?: Schedule;
  };
  if (!body.agentKey || !isAgentKey(body.agentKey)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: client } = await svc
    .from("clients")
    .select("id, plan")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "no_client" }, { status: 400 });

  const ent = entitlement(client.plan);

  // Enabling: enforce the plan's max concurrently-enabled agents.
  if (body.enabled === true) {
    const { data: enabledRows } = await svc
      .from("agent_config")
      .select("agent_key")
      .eq("client_id", client.id)
      .eq("enabled", true);
    const already = new Set((enabledRows ?? []).map((r: { agent_key: string }) => r.agent_key));
    if (!already.has(body.agentKey) && already.size >= ent.maxAgents) {
      return NextResponse.json(
        { error: "plan_limit", message: `Your ${ent.label} plan allows ${ent.maxAgents} active agent${ent.maxAgents === 1 ? "" : "s"}.` },
        { status: 403 }
      );
    }
  }

  // Scheduling: enforce the plan's allowed cadences.
  if (body.schedule && !scheduleAllowed(client.plan, body.schedule)) {
    return NextResponse.json(
      { error: "plan_limit", message: `Your ${ent.label} plan doesn't include ${body.schedule} scheduling.` },
      { status: 403 }
    );
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.autoSend === "boolean") patch.auto_send = body.autoSend;
  if (body.schedule) patch.schedule = body.schedule;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "no_change" }, { status: 400 });

  await svc.from("agent_config").update(patch).eq("client_id", client.id).eq("agent_key", body.agentKey);
  await svc.from("agent_audit").insert({
    client_id: client.id,
    actor: email,
    action: "config.updated",
    detail: `${body.agentKey}: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}`,
  });

  return NextResponse.json({ ok: true });
}
