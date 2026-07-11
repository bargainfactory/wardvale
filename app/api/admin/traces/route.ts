import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Admin trace export. Token-gated (ADMIN_TOKEN). Use it to debug agent
 * decisions and to mine real traffic into golden eval sets:
 *   GET /api/admin/traces?route=workflow&limit=200
 *   GET /api/admin/traces?route=workflow&format=eval   → {input, output} cases
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
  const route = url.searchParams.get("route");
  const format = url.searchParams.get("format");
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100));

  let query = supabase
    .from("traces")
    .select("id, route, status, latency_ms, tokens, input, output, spans, flags, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (route) query = query.eq("route", route);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });

  if (format === "eval") {
    // Golden-set seed: successful input/output pairs, ready to hand-label.
    const cases = (data ?? [])
      .filter((t) => t.input && t.output && t.status === "ok")
      .map((t) => ({ route: t.route, input: t.input, output: t.output }));
    return NextResponse.json({ count: cases.length, cases });
  }

  return NextResponse.json({ count: data?.length ?? 0, traces: data ?? [] });
}
