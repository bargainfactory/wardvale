import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Save the signed-in client's governance policy: auto-send daily spend cap,
 * per-action approval threshold, and email recipient-domain allowlist.
 */
export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    dailySpendCap?: number | string | null;
    requireApprovalOver?: number | string | null;
    allowedDomains?: string | null;
  };

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: client } = await svc.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!client) return NextResponse.json({ error: "no_client" }, { status: 400 });

  const num = (v: number | string | null | undefined) => {
    const n = Number(v);
    return v === "" || v == null || Number.isNaN(n) || n < 0 ? null : n;
  };

  await svc.from("client_policy").upsert(
    {
      client_id: client.id,
      daily_spend_cap: num(body.dailySpendCap),
      require_approval_over: num(body.requireApprovalOver),
      allowed_domains: (body.allowedDomains ?? "").toString().slice(0, 500) || null,
    },
    { onConflict: "client_id" }
  );
  await svc.from("agent_audit").insert({
    client_id: client.id,
    actor: email,
    action: "policy.updated",
    detail: "Updated governance policy",
  });

  return NextResponse.json({ ok: true });
}
