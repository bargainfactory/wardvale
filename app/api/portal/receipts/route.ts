import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Receipt drill-down: "every dollar we claim, you can click." Given one of the
 * caller's own outcome ids, return the approval that authorized it — the exact
 * draft that was sent, who approved it, and when it resolved. Outcomes without
 * an approval were auto-sent inside the client's own policy caps; the receipt
 * says so instead of pretending.
 */
export async function GET(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: client } = await svc.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!client) return NextResponse.json({ error: "no_client" }, { status: 400 });

  // Scope to the caller's own client — a foreign outcome id returns 404.
  const { data: outcome } = await svc
    .from("outcomes")
    .select("id, agent, action, kind, value, status, detail, ref, created_at, resolved_at, approval_id")
    .eq("client_id", (client as { id: string }).id)
    .eq("id", id)
    .maybeSingle();
  if (!outcome) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const o = outcome as {
    id: string;
    agent: string | null;
    action: string | null;
    kind: string | null;
    value: number;
    status: string;
    detail: string | null;
    ref: string | null;
    created_at: string;
    resolved_at: string | null;
    approval_id: string | null;
  };

  let approval: { draft: string | null; to: string | null; decidedBy: string | null; decidedAt: string | null } | null = null;
  if (o.approval_id) {
    const { data: a } = await svc
      .from("approvals")
      .select("payload, decided_by, decided_at")
      .eq("client_id", (client as { id: string }).id)
      .eq("id", o.approval_id)
      .maybeSingle();
    const row = a as { payload?: { draft?: string; to?: string } | null; decided_by?: string | null; decided_at?: string | null } | null;
    if (row) {
      approval = {
        draft: row.payload?.draft ?? null,
        to: row.payload?.to ?? null,
        decidedBy: row.decided_by ?? null,
        decidedAt: row.decided_at ?? null,
      };
    }
  }

  return NextResponse.json({
    receipt: {
      id: o.id,
      agent: o.agent,
      action: o.action,
      kind: o.kind,
      value: Number(o.value) || 0,
      status: o.status,
      detail: o.detail,
      ref: o.ref,
      createdAt: o.created_at,
      resolvedAt: o.resolved_at,
      autoSent: !o.approval_id,
      approval,
    },
  });
}
