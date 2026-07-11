import { NextResponse } from "next/server";
import { createServerSupabase, getPortalUserEmail } from "@/lib/supabase-ssr";

/**
 * Resolve a pending outcome: the owner confirms it paid off ("won", realized $)
 * or didn't ("lost"). RLS (outcomes_self_update) scopes it to their own client.
 */
export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, status } = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!id || (status !== "won" && status !== "lost")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("outcomes")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json({ ok: true, status });
}
