import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";

/** Export the signed-in client's governance audit log as CSV. */
export async function GET() {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: client } = await svc.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!client) return NextResponse.json({ error: "no_client" }, { status: 400 });

  const { data } = await svc
    .from("agent_audit")
    .select("created_at, actor, action, detail")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(5000);

  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = "timestamp,actor,action,detail";
  const rows = ((data ?? []) as { created_at: string; actor: string | null; action: string; detail: string | null }[]).map(
    (r) => [esc(r.created_at), esc(r.actor), esc(r.action), esc(r.detail)].join(",")
  );
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="flowforge-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
