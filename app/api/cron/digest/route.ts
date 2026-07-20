import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendMorningDigest } from "@/lib/email";

// The five-minute morning: email each active client their pending drafts as a
// short daily ritual — count, realistic time estimate, a peek at the top items,
// and the learning-loop counter. Same CRON_SECRET auth as the scheduler.

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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wardvale.com";
  const { data: clients } = await svc.from("clients").select("id, email, name").eq("status", "active");
  let sent = 0;
  for (const c of ((clients ?? []) as { id: string; email: string | null; name: string | null }[]).slice(0, 500)) {
    if (!c.email) continue;
    const { data: pendingRows, count } = await svc
      .from("approvals")
      .select("summary", { count: "exact" })
      .eq("client_id", c.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(3);
    const pending = count ?? 0;
    if (pending === 0) continue; // clean queue → no email; silence is the reward

    const { count: learned } = await svc
      .from("agent_feedback")
      .select("id", { count: "exact", head: true })
      .eq("client_id", c.id);

    const ok = await sendMorningDigest({
      to: c.email,
      name: c.name ?? undefined,
      pending,
      // ~25s per approval decision, rounded up to a whole minute.
      minutes: Math.max(1, Math.ceil((pending * 25) / 60)),
      summaries: ((pendingRows ?? []) as { summary: string | null }[]).map((r) => r.summary ?? "").filter(Boolean),
      learned: learned ?? 0,
      portalUrl: `${siteUrl}/portal?tab=approvals`,
    });
    if (ok) sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
