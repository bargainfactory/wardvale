import { createServerSupabase } from "@/lib/supabase-ssr";

export type PortalAutomation = {
  name: string;
  status: string;
  runs: number;
  successRate: number;
  saved: number;
  lastRun: string;
};
export type PortalLog = { time: string; event: string; type: string };
export type PortalKpis = { runs: string; hours: string; success: string; roi: string };
export type PortalData = {
  clientName: string;
  kpis: PortalKpis;
  automations: PortalAutomation[];
  logs: PortalLog[];
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type RunRow = {
  automation_id: string | null;
  status: string;
  minutes_saved: number;
  dollars_saved: number;
  detail: string | null;
  created_at: string;
};

/**
 * Real portal data for a signed-in client, or null when Supabase is
 * unconfigured / the user has no client row / anything errors — callers then
 * fall back to the labeled demo. RLS ensures a user only sees their own rows.
 */
export async function getPortalData(email: string): Promise<PortalData | null> {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return null;

    const { data: client } = await supabase
      .from("clients")
      .select("id, name")
      .eq("email", email)
      .maybeSingle();
    if (!client) return null;

    const [{ data: automations }, { data: runs }, { data: rollup }] = await Promise.all([
      supabase.from("automations").select("id, name, status").eq("client_id", client.id),
      supabase
        .from("runs")
        .select("automation_id, status, minutes_saved, dollars_saved, detail, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("client_month_rollup").select("*").eq("client_id", client.id).maybeSingle(),
    ]);

    const runList: RunRow[] = (runs as RunRow[] | null) ?? [];

    const byAuto = new Map<string, { runs: number; ok: number; saved: number; last: string }>();
    for (const r of runList) {
      const k = r.automation_id ?? "none";
      const cur = byAuto.get(k) ?? { runs: 0, ok: 0, saved: 0, last: r.created_at };
      cur.runs += 1;
      if (r.status === "success") cur.ok += 1;
      cur.saved += Number(r.dollars_saved) || 0;
      byAuto.set(k, cur);
    }

    const autos: PortalAutomation[] = ((automations as { id: string; name: string; status: string }[] | null) ?? []).map(
      (a) => {
        const agg = byAuto.get(a.id) ?? { runs: 0, ok: 0, saved: 0, last: "" };
        return {
          name: a.name,
          status: a.status,
          runs: agg.runs,
          successRate: agg.runs ? Math.round((agg.ok / agg.runs) * 1000) / 10 : 100,
          saved: Math.round(agg.saved),
          lastRun: agg.last ? relTime(agg.last) : "—",
        };
      }
    );

    const logs: PortalLog[] = runList.slice(0, 6).map((r) => ({
      time: new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      event: r.detail ?? "Automation run",
      type: r.status === "success" ? "success" : "info",
    }));

    const roll = rollup as { runs_this_month?: number; hours_saved?: number; success_rate?: number } | null;
    const totalSaved = Math.round(runList.reduce((s, r) => s + (Number(r.dollars_saved) || 0), 0));
    const kpis: PortalKpis = {
      runs: (roll?.runs_this_month ?? runList.length).toLocaleString(),
      hours: `${Math.round(Number(roll?.hours_saved ?? 0))}h`,
      success: `${roll?.success_rate ?? 100}%`,
      roi: `$${totalSaved.toLocaleString()}`,
    };

    return { clientName: client.name, kpis, automations: autos, logs };
  } catch {
    return null;
  }
}
