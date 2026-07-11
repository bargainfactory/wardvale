import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendApprovalNotification } from "@/lib/email";

// Daily digest: email each active client the count of approvals still pending,
// so nothing sits in the queue forgotten. Same CRON_SECRET auth as the scheduler.

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const url = new URL(req.url);
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || url.searchParams.get("key") || "";
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: clients } = await svc.from("clients").select("id, email").eq("status", "active");
  let sent = 0;
  for (const c of ((clients ?? []) as { id: string; email: string | null }[]).slice(0, 500)) {
    if (!c.email) continue;
    const { count } = await svc
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("client_id", c.id)
      .eq("status", "pending");
    if ((count ?? 0) > 0 && (await sendApprovalNotification(c.email, count ?? 0))) sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
