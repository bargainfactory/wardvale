import { createServerSupabase } from "@/lib/supabase-ssr";
import { agentName, planPrice } from "@/lib/agents-catalog";
import { getConnectorByName } from "@/lib/connectors";

export type PortalAutomation = {
  id: string;
  name: string;
  status: string;
  runs: number;
  successRate: number;
  saved: number;
  lastRun: string;
};
export type PortalLog = { time: string; event: string; type: string };
export type PortalKpis = { runs: string; hours: string; success: string; roi: string };
export type PortalConnection = {
  provider: string;
  status: string;
  scope: string;
  health?: "ok" | "expired" | "error";
  reconnectHref?: string;
};
export type PortalAudit = { time: string; actor: string; action: string; detail: string };
export type PortalApproval = { id: string; agent: string; action: string; summary: string; createdAt: string; draft?: string };
export type PortalAgentConfig = { key: string; name: string; enabled: boolean; autoSend: boolean; schedule: string };
export type PortalRoi = { realized: number; pipeline: number; won: number; resolved: number; winRate: number };
export type PortalRoiProof = {
  monthlyCost: number;
  realized: number;
  multiple: number | null; // realized / monthly cost; null on the free trial
  remaining: number; // $ left to break even this month
  met: boolean; // broken even
  daysActive: number;
  guaranteeDays: number; // the break-even guarantee window (21)
};
export type PortalOutcome = { id: string; agent: string; kind: string; value: number; status: string; detail: string; createdAt: string };
export type PortalPolicy = { dailySpendCap: number | null; requireApprovalOver: number | null; allowedDomains: string };
export type PortalData = {
  clientName: string;
  onboarded: boolean;
  plan: string;
  ingestKeyLast4: string;
  kpis: PortalKpis;
  roi: PortalRoi;
  roiProof: PortalRoiProof;
  automations: PortalAutomation[];
  logs: PortalLog[];
  connections: PortalConnection[];
  audit: PortalAudit[];
  approvals: PortalApproval[];
  agentConfigs: PortalAgentConfig[];
  outcomes: PortalOutcome[];
  policy: PortalPolicy;
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

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
 * Real control-plane data for a signed-in client, or null when Supabase is
 * unconfigured / the user has no client row / anything errors — callers then
 * fall back to the labeled demo. RLS ensures a user only sees their own rows.
 */
export async function getPortalData(email: string): Promise<PortalData | null> {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return null;

    const { data: client } = await supabase
      .from("clients")
      .select("id, name, onboarded, plan, created_at, ingest_key")
      .eq("email", email)
      .maybeSingle();
    if (!client) return null;
    const ingestKeyLast4 = ((client as { ingest_key?: string }).ingest_key ?? "").slice(-4);

    const [
      { data: automations },
      { data: runs },
      { data: rollup },
      { data: connections },
      { data: audit },
      { data: approvalsData },
      { data: configData },
      { data: outcomeData },
      { data: policyData },
    ] = await Promise.all([
      supabase.from("automations").select("id, name, status").eq("client_id", client.id),
      supabase
        .from("runs")
        .select("automation_id, status, minutes_saved, dollars_saved, detail, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("client_month_rollup").select("*").eq("client_id", client.id).maybeSingle(),
      supabase.from("connections").select("provider, status, scope, expires_at").eq("client_id", client.id),
      supabase
        .from("agent_audit")
        .select("actor, action, detail, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("approvals")
        .select("id, agent, action, summary, payload, created_at")
        .eq("client_id", client.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("agent_config").select("agent_key, enabled, auto_send, schedule").eq("client_id", client.id),
      supabase
        .from("outcomes")
        .select("id, agent, kind, value, status, detail, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("client_policy").select("daily_spend_cap, require_approval_over, allowed_domains").eq("client_id", client.id).maybeSingle(),
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
          id: a.id,
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
      time: timeOf(r.created_at),
      event: r.detail ?? "Automation run",
      type: r.status === "success" ? "success" : "info",
    }));

    const conns: PortalConnection[] = ((connections as { provider: string; status: string; scope: string | null; expires_at: string | null }[] | null) ?? []).map(
      (c) => {
        const expired = c.expires_at ? new Date(c.expires_at).getTime() < Date.now() : false;
        const health: PortalConnection["health"] =
          c.status === "error" || c.status === "disconnected" ? "error" : expired ? "expired" : "ok";
        // API-key connectors reconnect via the paste-key form; OAuth via the flow.
        const conn = getConnectorByName(c.provider);
        const reconnectHref = conn
          ? conn.tokenAuth === "apikey"
            ? "/connections"
            : `/api/connect/${conn.id}/start`
          : undefined;
        return { provider: c.provider, status: c.status, scope: c.scope ?? "read/write", health, reconnectHref };
      }
    );

    const auditRows: PortalAudit[] = ((audit as { actor: string | null; action: string; detail: string | null; created_at: string }[] | null) ?? []).map(
      (a) => ({ time: timeOf(a.created_at), actor: a.actor ?? "system", action: a.action, detail: a.detail ?? "" })
    );

    const approvals: PortalApproval[] = ((approvalsData as { id: string; agent: string | null; action: string; summary: string | null; payload: { draft?: string } | null; created_at: string }[] | null) ?? []).map(
      (a) => ({ id: a.id, agent: a.agent ?? "agent", action: a.action, summary: a.summary ?? "", createdAt: relTime(a.created_at), draft: a.payload?.draft ?? undefined })
    );

    const agentConfigs: PortalAgentConfig[] = ((configData as { agent_key: string; enabled: boolean; auto_send: boolean; schedule: string }[] | null) ?? []).map(
      (c) => ({ key: c.agent_key, name: agentName(c.agent_key), enabled: c.enabled, autoSend: c.auto_send, schedule: c.schedule })
    );

    const outcomeRows = (outcomeData as { id: string; agent: string | null; kind: string | null; value: number; status: string; detail: string | null; created_at: string }[] | null) ?? [];
    const realized = outcomeRows.filter((o) => o.status === "won").reduce((s, o) => s + (Number(o.value) || 0), 0);
    const pipeline = outcomeRows.filter((o) => o.status === "pending").reduce((s, o) => s + (Number(o.value) || 0), 0);
    const won = outcomeRows.filter((o) => o.status === "won").length;
    const resolved = outcomeRows.filter((o) => o.status !== "pending").length;
    const roi: PortalRoi = {
      realized: Math.round(realized),
      pipeline: Math.round(pipeline),
      won,
      resolved,
      winRate: resolved ? Math.round((won / resolved) * 100) : 0,
    };

    const monthlyCost = planPrice((client as { plan?: string }).plan);
    const createdAt = (client as { created_at?: string }).created_at;
    const daysActive = createdAt ? Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)) : 0;
    const roiProof: PortalRoiProof = {
      monthlyCost,
      realized: Math.round(realized),
      multiple: monthlyCost > 0 ? Math.round((realized / monthlyCost) * 10) / 10 : null,
      remaining: Math.max(0, Math.round(monthlyCost - realized)),
      met: realized >= monthlyCost,
      daysActive,
      guaranteeDays: 21,
    };
    const pol = policyData as { daily_spend_cap: number | null; require_approval_over: number | null; allowed_domains: string | null } | null;
    const policy: PortalPolicy = {
      dailySpendCap: pol?.daily_spend_cap != null ? Number(pol.daily_spend_cap) : null,
      requireApprovalOver: pol?.require_approval_over != null ? Number(pol.require_approval_over) : null,
      allowedDomains: pol?.allowed_domains ?? "",
    };

    const outcomes: PortalOutcome[] = outcomeRows.slice(0, 30).map((o) => ({
      id: o.id,
      agent: o.agent ?? agentName(o.kind ?? ""),
      kind: o.kind ?? "",
      value: Math.round(Number(o.value) || 0),
      status: o.status,
      detail: o.detail ?? "",
      createdAt: relTime(o.created_at),
    }));

    const roll = rollup as { runs_this_month?: number; hours_saved?: number; success_rate?: number } | null;
    const totalSaved = Math.round(runList.reduce((s, r) => s + (Number(r.dollars_saved) || 0), 0));
    const kpis: PortalKpis = {
      runs: (roll?.runs_this_month ?? runList.length).toLocaleString(),
      hours: `${Math.round(Number(roll?.hours_saved ?? 0))}h`,
      success: `${roll?.success_rate ?? 100}%`,
      roi: `$${totalSaved.toLocaleString()}`,
    };

    return {
      clientName: client.name,
      onboarded: Boolean((client as { onboarded?: boolean }).onboarded),
      plan: (client as { plan?: string }).plan ?? "trial",
      ingestKeyLast4,
      kpis,
      roi,
      roiProof,
      automations: autos,
      logs,
      connections: conns,
      audit: auditRows,
      approvals,
      agentConfigs,
      outcomes,
      policy,
    };
  } catch {
    return null;
  }
}
