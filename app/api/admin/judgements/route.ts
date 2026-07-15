import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Admin judgements export (roadmap U1 — auto-built datasets). Token-gated
 * (ADMIN_TOKEN). The judgements table is the dataset harvested from real traffic
 * by /api/cron/judge; this exports it for offline eval / LangSmith import,
 * attributable to a prompt_version.
 *   GET /api/admin/judgements?agent=ar-followup&limit=200
 *   GET /api/admin/judgements?verdict=fail&format=eval   → labeled golden cases
 * Header: Authorization: Bearer <ADMIN_TOKEN>  (or x-admin-token)
 */
export async function GET(req: Request) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-admin-token")?.trim() ||
    "";
  if (provided !== token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const url = new URL(req.url);
  const agent = url.searchParams.get("agent");
  const verdict = url.searchParams.get("verdict");
  const format = url.searchParams.get("format");
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit")) || 200));

  let query = supabase
    .from("judgements")
    .select("id, agent, kind, prompt_version, verdict, overall, scores, component_passed, component_failed, checks, reasoning, model, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (agent) query = query.eq("kind", agent);
  if (verdict) query = query.eq("verdict", verdict);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });

  if (format === "eval") {
    // Golden set: LLM-judged decisions attributed to a prompt version.
    const cases = (data ?? [])
      .filter((j) => j.verdict)
      .map((j) => ({
        agent: j.kind,
        prompt_version: j.prompt_version,
        verdict: j.verdict,
        overall: j.overall,
        scores: j.scores,
        component: { passed: j.component_passed, failed: j.component_failed },
      }));
    return NextResponse.json({ count: cases.length, cases });
  }

  return NextResponse.json({ count: data?.length ?? 0, judgements: data ?? [] });
}
