import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

// Public, aggregate-only proof for the landing page: total realized value the
// agents have made across all clients, businesses served, and actions taken.
// No per-client data is ever returned. Cached to keep it cheap + unscannable.
export const revalidate = 300;

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ realized: 0, businesses: 0, actions: 0 });

  try {
    const { data } = await supabase.from("outcomes").select("client_id, value, status").limit(20000);
    const rows = (data ?? []) as { client_id: string; value: number; status: string }[];
    const realized = rows.filter((o) => o.status === "won").reduce((s, o) => s + (Number(o.value) || 0), 0);
    const businesses = new Set(rows.map((o) => o.client_id)).size;
    return NextResponse.json({
      realized: Math.round(realized / 100) * 100, // round to nearest $100
      businesses,
      actions: rows.length,
    });
  } catch {
    return NextResponse.json({ realized: 0, businesses: 0, actions: 0 });
  }
}
