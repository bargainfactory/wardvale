import { NextResponse } from "next/server";
import { createServerSupabase, getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Approve or reject a queued agent action. RLS (approvals_self_update) ensures a
 * user can only decide their own client's approvals; the decision is recorded to
 * the governance audit log.
 */
export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, decision } = (await req.json().catch(() => ({}))) as { id?: string; decision?: string };
  if (!id || (decision !== "approved" && decision !== "rejected")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("approvals")
    .update({ status: decision, decided_by: email, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, client_id, action, summary")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const svc = getServiceClient();
  if (svc) {
    await svc.from("agent_audit").insert({
      client_id: data.client_id,
      actor: email,
      action: `approval.${decision}`,
      detail: data.summary ?? data.action,
    });
  }

  return NextResponse.json({ ok: true, status: decision });
}
