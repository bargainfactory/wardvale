import { NextResponse } from "next/server";
import { createServerSupabase, getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Kill switch: pause/resume an agent. RLS (automations_self_update) guarantees a
 * signed-in user can only change their own agents; every toggle is written to
 * the immutable governance audit log.
 */
export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { agentId, status } = (await req.json().catch(() => ({}))) as {
    agentId?: string;
    status?: string;
  };
  if (!agentId || (status !== "active" && status !== "paused")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("automations")
    .update({ status })
    .eq("id", agentId)
    .select("id, name, client_id")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const svc = getServiceClient();
  if (svc) {
    await svc.from("agent_audit").insert({
      client_id: data.client_id,
      automation_id: data.id,
      actor: email,
      action: status === "paused" ? "agent.paused" : "agent.resumed",
      detail: data.name,
    });
  }

  return NextResponse.json({ ok: true, status });
}
