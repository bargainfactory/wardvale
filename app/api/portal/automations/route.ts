import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { clientScope } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { planOf } from "@/lib/agents-catalog";

/**
 * Custom Automations composer (Growth+/Custom add-on): the owner's scheduled,
 * instruction-driven reports. CRUD scoped to the caller's own client; the lane
 * they run through hardcodes report-only output (never a send). Free-text
 * instructions are size-capped — they end up inside a prompt.
 */

const GATED_PLANS = new Set(["growth", "scale"]);

async function resolve() {
  const email = await getPortalUserEmail();
  if (!email) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const svc = getServiceClient();
  if (!svc) return { error: NextResponse.json({ error: "not_configured" }, { status: 503 }) };
  const { data: client } = await svc.from("clients").select("id, plan").eq("email", email.toLowerCase()).maybeSingle();
  if (!client) return { error: NextResponse.json({ error: "no_client" }, { status: 400 }) };
  const c = client as { id: string; plan?: string };
  return { email, svc, clientId: c.id, plan: planOf(c.plan) };
}

export async function GET() {
  const r = await resolve();
  if ("error" in r) return r.error;
  const scope = clientScope(r.svc, r.clientId);
  const { data } = await scope
    .select("automations", "id, name, instructions, schedule, run_hour, run_day, notify, status, last_run_at")
    .eq("kind", "custom")
    .order("created_at", { ascending: false });
  return NextResponse.json({ automations: data ?? [], plan: r.plan, gated: !GATED_PLANS.has(r.plan) });
}

export async function POST(req: Request) {
  const r = await resolve();
  if ("error" in r) return r.error;
  if (!GATED_PLANS.has(r.plan)) return NextResponse.json({ error: "plan_gated" }, { status: 403 });

  const rl = await rateLimit(`automations:${r.clientId}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    instructions?: string;
    schedule?: string;
    runHour?: number;
    runDay?: number | null;
    notify?: string;
  };
  const name = (body.name ?? "").trim().slice(0, 120);
  const instructions = (body.instructions ?? "").trim().slice(0, 2000);
  if (!name || !instructions) return NextResponse.json({ error: "name_and_instructions_required" }, { status: 400 });

  const schedule = body.schedule === "weekly" ? "weekly" : body.schedule === "off" ? "off" : "daily";
  const runHour = Number.isInteger(body.runHour) && body.runHour! >= 0 && body.runHour! <= 23 ? body.runHour : 9;
  const runDay = Number.isInteger(body.runDay) && body.runDay! >= 0 && body.runDay! <= 6 ? body.runDay : null;
  const notify = body.notify === "instant" ? "instant" : "digest";

  const scope = clientScope(r.svc, r.clientId);
  const { data: countRows } = await scope.select("automations", "id").eq("kind", "custom");
  if ((countRows?.length ?? 0) >= 10) return NextResponse.json({ error: "limit_reached" }, { status: 400 });

  const { data: row, error } = await scope
    .insert("automations", { name, instructions, schedule, run_hour: runHour, run_day: runDay, notify, kind: "custom", status: "active" })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "create_failed" }, { status: 500 });

  await scope.insert("agent_audit", { actor: r.email, action: "automation.created", detail: `${name} (${schedule})` });
  return NextResponse.json({ ok: true, id: (row as { id?: string } | null)?.id });
}

export async function PATCH(req: Request) {
  const r = await resolve();
  if ("error" in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!body.id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const status = body.status === "paused" ? "paused" : "active";
  const scope = clientScope(r.svc, r.clientId);
  await scope.update("automations", { status }).eq("id", body.id).eq("kind", "custom");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const r = await resolve();
  if ("error" in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const scope = clientScope(r.svc, r.clientId);
  await scope.delete("automations").eq("id", body.id).eq("kind", "custom");
  await scope.insert("agent_audit", { actor: r.email, action: "automation.deleted", detail: body.id });
  return NextResponse.json({ ok: true });
}
