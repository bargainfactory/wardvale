import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { planOf } from "@/lib/agents-catalog";
import { planFromIntake, type StudioIntake } from "@/lib/studio-generator";
import { applyConfigPlan } from "@/lib/studio-apply";

/**
 * Agent Design Studio persistence. Two actions, both auth'd by session email with
 * a service-role write scoped to the caller's own client:
 *   - save:  upsert the raw questionnaire answers (partial/skip autosave).
 *   - apply: deterministically map answers → live config and write it, marking
 *            onboarding complete. The server recomputes the plan from `intake`
 *            (never trusts a client-computed config) so the safe-defaults hold.
 */

// Bound the stored answers so a single free-text field can't inflate every
// future prompt / the JSONB payload.
const MAX_INTAKE_BYTES = 24_000;

function tooBig(intake: unknown): boolean {
  try {
    return JSON.stringify(intake ?? {}).length > MAX_INTAKE_BYTES;
  } catch {
    return true;
  }
}

export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: "save" | "apply";
    intake?: StudioIntake;
  };
  const action = body.action === "apply" ? "apply" : "save";
  const intake = (body.intake ?? { version: 1 }) as StudioIntake;

  if (tooBig(intake)) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: client } = await svc
    .from("clients")
    .select("id, plan")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "no_client" }, { status: 400 });

  if (action === "save") {
    // Persist raw answers only — no config changes until the owner hits Apply.
    await svc
      .from("business_profile")
      .upsert({ client_id: client.id, intake }, { onConflict: "client_id" });
    return NextResponse.json({ ok: true });
  }

  // apply — recompute the plan server-side from the answers, then write it.
  const plan = planFromIntake(intake, { plan: planOf((client as { plan?: string }).plan) });
  const ok = await applyConfigPlan(client.id, plan);
  if (!ok) return NextResponse.json({ error: "apply_failed" }, { status: 503 });

  await svc.from("clients").update({ onboarded: true }).eq("id", client.id);
  return NextResponse.json({ ok: true, rationale: plan.rationale });
}
