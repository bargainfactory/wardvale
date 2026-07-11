"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  DollarSign,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Pause,
  Phone,
  Play,
  Plug,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/locale-context";
import { entitlement, type Schedule } from "@/lib/agents-catalog";
import type { PortalAgentConfig, PortalApproval, PortalAutomation, PortalAudit, PortalConnection, PortalKpis, PortalLog, PortalOutcome, PortalRoi } from "@/lib/portal";
import type { PeerBenchmarks } from "@/lib/peer-benchmarks";

type Props = {
  clientName: string;
  kpis: PortalKpis;
  deltas?: { runs: string; hours: string; success: string; roi: string };
  automations: PortalAutomation[];
  logs: PortalLog[];
  connections: PortalConnection[];
  audit: PortalAudit[];
  approvals: PortalApproval[];
  onboarded: boolean;
  plan: string;
  agentConfigs: PortalAgentConfig[];
  roi: PortalRoi;
  outcomes: PortalOutcome[];
  benchmarks: PeerBenchmarks | null;
  isDemo: boolean;
  authEnabled: boolean;
  userEmail: string | null;
};

type Tab = "overview" | "roi" | "agents" | "approvals" | "connections" | "audit";

const PROVIDER_ICON: Record<string, typeof Mail> = {
  gmail: Mail,
  google: Mail,
  shopify: ShoppingBag,
  calendly: Calendar,
  slack: MessageSquare,
  twilio: Phone,
  whatsapp: Phone,
  hubspot: Users,
  stripe: CreditCard,
};

function providerIcon(name: string) {
  const key = name.toLowerCase();
  for (const k of Object.keys(PROVIDER_ICON)) if (key.includes(k)) return PROVIDER_ICON[k];
  return Plug;
}

// Sample datasets for the per-agent "Run a cycle" demo — each shows the agent's
// routing on realistic input. When a client is signed in, cycles instead run on
// their OWN live connected data (via /api/portal/agents/run) and persist.
const SAMPLE_INBOX = [
  { from: "maria@events.com", subject: "Catering for 40 on the 22nd?", body: "Hi! Do you cater private events? We're a party of 40 on the 22nd." },
  { from: "no-reply@promos.com", subject: "🔥 50% off this weekend only", body: "Shop our biggest sale of the year. Unsubscribe anytime." },
  { from: "upset@customer.com", subject: "Terrible experience — I want a refund", body: "This was unacceptable and I want my money back now." },
  { from: "jon@acme.com", subject: "Are you open next Friday evening?", body: "Checking availability for a table next Friday." },
];
const SAMPLE_INVOICES = [
  { number: "1043", customer: "Acme LLC", email: "ap@acme.com", amount: 2400, daysOverdue: 21 },
  { number: "1039", customer: "Globex", email: "billing@globex.com", amount: 8800, daysOverdue: 75 },
  { number: "1051", customer: "Initech", email: "ap@initech.com", amount: 1200, daysOverdue: 0 },
];
const SAMPLE_CARTS = [
  { customer: "Ana Lee", email: "ana@example.com", total: 128.5, items: "Wool scarf, Beanie", url: "https://shop.example/checkout/abc" },
  { customer: "Bo Kim", phone: "+15551230000", total: 59, items: "Trail socks (3-pack)" },
];
const SAMPLE_REVIEWS = [
  { customer: "Dana R.", email: "dana@example.com", service: "Kitchen faucet install" },
  { customer: "Eli M.", phone: "+15559990000", service: "Drain cleaning" },
];
const SAMPLE_LEADS = [
  { name: "Frank T.", email: "frank@example.com", source: "Website form", message: "Need a 3-bed rental downtown, moving next month." },
  { name: "Grace P.", phone: "+15557778888", source: "Instagram DM", message: "Do you do same-week showings?" },
];
const SAMPLE_TICKETS = [
  { from: "buyer@example.com", subject: "Where is my order #10432?", body: "It's been 8 days with no tracking update." },
  { from: "vip@example.com", subject: "Wrong size received", body: "I ordered L but got S — need a swap before the weekend." },
];

// Each runnable agent: the id the run route dispatches on, and the sample body
// used in the demo. "inbox-triage" carries no agent field so it hits the default.
const RUNNERS: { id: string; label: string; sample: Record<string, unknown> }[] = [
  { id: "inbox-triage", label: "Inbox triage", sample: { messages: SAMPLE_INBOX } },
  { id: "ar-followup", label: "AR follow-up", sample: { agent: "ar-followup", invoices: SAMPLE_INVOICES } },
  { id: "cart-recovery", label: "Cart recovery", sample: { agent: "cart-recovery", carts: SAMPLE_CARTS } },
  { id: "review-request", label: "Review requests", sample: { agent: "review-request", targets: SAMPLE_REVIEWS } },
  { id: "lead-qualification", label: "Lead follow-up", sample: { agent: "lead-qualification", leads: SAMPLE_LEADS } },
  { id: "support-triage", label: "Support triage", sample: { agent: "support-triage", messages: SAMPLE_TICKETS } },
];

const TABS = ["overview", "roi", "agents", "approvals", "connections", "audit"] as const;

export function PortalDashboard(props: Props) {
  const { clientName, kpis, deltas, logs, connections, onboarded, plan, isDemo, authEnabled, userEmail } = props;
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "overview";
    const q = new URLSearchParams(window.location.search).get("tab");
    return (TABS as readonly string[]).includes(q ?? "") ? (q as Tab) : "overview";
  });
  const [agents, setAgents] = useState<PortalAutomation[]>(props.automations);
  const [audit, setAudit] = useState<PortalAudit[]>(props.audit);
  const [approvals, setApprovals] = useState<PortalApproval[]>(props.approvals);
  const [busy, setBusy] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [configs, setConfigs] = useState<PortalAgentConfig[]>(props.agentConfigs);
  const [outcomes, setOutcomes] = useState<PortalOutcome[]>(props.outcomes);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const { roi } = props;
  const ent = entitlement(plan);

  // Confirm a pending outcome paid off (realized $) or didn't — optimistic.
  async function resolveOutcome(id: string, status: "won" | "lost") {
    const prev = outcomes;
    setOutcomes((list) => list.map((o) => (o.id === id ? { ...o, status } : o)));
    if (isDemo) return;
    try {
      const res = await fetch("/api/portal/outcomes/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) setOutcomes(prev);
    } catch {
      setOutcomes(prev);
    }
  }
  const enabledCount = configs.filter((c) => c.enabled).length;

  // Update one agent's config (enable, auto-send, schedule) — optimistic, with
  // server-side plan entitlements. On rejection we revert and surface the reason.
  async function updateConfig(key: string, patch: Partial<{ enabled: boolean; autoSend: boolean; schedule: Schedule }>) {
    const prev = configs;
    setConfigs((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
    if (isDemo) return;
    try {
      const res = await fetch("/api/portal/agents/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentKey: key, ...patch }),
      });
      if (!res.ok) {
        setConfigs(prev);
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        if (d.message) window.alert(d.message);
      } else {
        setAudit((log) => [{ time: "just now", actor: userEmail ?? "you", action: "config.updated", detail: key }, ...log]);
      }
    } catch {
      setConfigs(prev);
    }
  }

  // Run one end-to-end cycle for a single agent: read → decide (guarded, traced)
  // → queue approval-gated actions. Signed-in clients run on their OWN live data
  // (pulled from their connected tools, persisted). The demo runs on samples and
  // merges the proposed actions into the local approvals view.
  async function run(r: (typeof RUNNERS)[number]) {
    setRunning(r.id);
    try {
      if (!isDemo) {
        // Live: runs on the client's own connected data and persists. The
        // endpoint returns the queued approvals WITH their real ids, so we merge
        // them in place — no reload — and they're immediately approvable.
        const res = await fetch("/api/portal/agents/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agent: r.id }),
        });
        const data = (await res.json()) as { decided?: number; queued?: number; approvals?: PortalApproval[] };
        const created = data.approvals ?? [];
        setApprovals((list) => [...created, ...list]);
        setAudit((log) => [
          { time: "just now", actor: "runtime", action: "agent.run", detail: `${r.label}: ${data.decided ?? 0} decided, ${created.length} queued for approval` },
          ...log,
        ]);
        setTab("approvals");
      } else {
        // Demo: runs on a sample dataset; merge the proposed actions locally.
        const res = await fetch("/api/agents/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(r.sample),
        });
        const data = (await res.json()) as {
          decided?: number;
          actions?: { action: string; agent: string; summary: string; needsApproval: boolean }[];
        };
        const created = (data.actions ?? [])
          .filter((a) => a.needsApproval)
          .map((a, i) => ({
            id: `run-${i}-${Math.random().toString(36).slice(2)}`,
            agent: a.agent,
            action: a.action,
            summary: a.summary,
            createdAt: "just now",
          }));
        setApprovals((list) => [...created, ...list]);
        setAudit((log) => [
          { time: "just now", actor: "runtime", action: "agent.run", detail: `${r.label}: ${data.decided ?? 0} decided, ${created.length} queued for approval` },
          ...log,
        ]);
        setTab("approvals");
      }
    } catch {
      /* ignore */
    }
    setRunning(null);
  }

  async function decide(a: PortalApproval, decision: "approved" | "rejected", editedDraft?: string) {
    setApprovals((list) => list.filter((x) => x.id !== a.id));
    if (editing?.id === a.id) setEditing(null);
    setAudit((log) => [
      { time: "just now", actor: userEmail ?? "you", action: `approval.${decision}`, detail: a.summary },
      ...log,
    ]);
    if (!isDemo) {
      try {
        await fetch("/api/portal/approvals/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: a.id, decision, editedDraft }),
        });
      } catch {
        /* optimistic — already removed */
      }
    }
  }

  async function toggleAgent(a: PortalAutomation) {
    const next = a.status === "active" ? "paused" : "active";
    setBusy(a.id);
    setAgents((list) => list.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    setAudit((log) => [
      { time: "just now", actor: userEmail ?? "you", action: next === "paused" ? "agent.paused" : "agent.resumed", detail: a.name },
      ...log,
    ]);
    if (!isDemo) {
      try {
        const res = await fetch("/api/portal/toggle-agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agentId: a.id, status: next }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setAgents((list) => list.map((x) => (x.id === a.id ? { ...x, status: a.status } : x)));
      }
    }
    setBusy(null);
  }

  const activeCount = agents.filter((a) => a.status === "active").length;

  return (
    <PageLayout>
      <div className="container pb-10">
        {/* Status bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {isDemo ? (
            <>
              <span className="rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
                {t("portal.demo")}
              </span>
              {authEnabled && (
                <Link href="/portal/login">
                  <Button variant="outline" size="sm">
                    <Lock className="h-3.5 w-3.5" />
                    {t("portal.signin")}
                  </Button>
                </Link>
              )}
            </>
          ) : (
            <>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                Live · signed in
              </span>
              {userEmail && <span className="text-xs text-muted-foreground">{userEmail}</span>}
              <SignOutButton />
            </>
          )}
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
            Agent Control Plane · {clientName}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Your agents, secured &amp; in one place.</h1>
          <p className="mt-1 text-muted-foreground">
            {activeCount} active · {connections.length} connections · every action audited.
          </p>
        </motion.div>

        {/* Onboarding nudge — only for a live client who hasn't finished setup */}
        {!isDemo && !onboarded && (
          <Link
            href="/portal/onboarding"
            className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-electric/30 bg-cyan-electric/10 px-5 py-4 transition hover:bg-cyan-electric/15"
          >
            <Sparkles className="h-5 w-5 text-cyan-electric" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Finish setting up your agents</p>
              <p className="text-sm text-muted-foreground">Pick a pack, add your business details, and connect your tools — 2 minutes.</p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-electric">
              Get set up <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>
        )}

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-full border border-border bg-card/40 p-1 text-sm">
          <TabButton icon={LayoutDashboard} label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
          <TabButton icon={DollarSign} label="ROI" active={tab === "roi"} onClick={() => setTab("roi")} />
          <TabButton icon={Bot} label={`Agents (${agents.length})`} active={tab === "agents"} onClick={() => setTab("agents")} />
          <TabButton icon={ClipboardCheck} label={`Approvals (${approvals.length})`} active={tab === "approvals"} onClick={() => setTab("approvals")} />
          <TabButton icon={Plug} label={`Connections (${connections.length})`} active={tab === "connections"} onClick={() => setTab("connections")} />
          <TabButton icon={ShieldCheck} label="Audit" active={tab === "audit"} onClick={() => setTab("audit")} />
        </div>

        {tab === "overview" && (
          <div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPI icon={Activity} label={t("portal.runsMonth")} value={kpis.runs} delta={deltas?.runs} />
              <KPI icon={Clock} label={t("portal.hoursSaved")} value={kpis.hours} delta={deltas?.hours} />
              <KPI icon={CheckCircle2} label={t("portal.successRate")} value={kpis.success} delta={deltas?.success} />
              <KPI icon={ArrowUpRight} label={t("portal.roiMonth")} value={kpis.roi} delta={deltas?.roi} />
            </div>
            <div className="mt-6 rounded-3xl border border-border bg-card/40 backdrop-blur">
              <div className="border-b border-border px-6 py-4 font-display font-semibold">Recent activity</div>
              {logs.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">Run activity will stream here.</p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {logs.map((l, i) => (
                    <li key={i} className="flex items-center gap-3 px-6 py-3">
                      <span className="text-xs text-muted-foreground tabular-nums">{l.time}</span>
                      <span className="text-sm">{l.event}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "roi" && (
          <div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-5">
                <span className="text-xs text-muted-foreground">Realized value (confirmed)</span>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-emerald-300">${roi.realized.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">{roi.won} outcomes won</p>
              </div>
              <div className="rounded-2xl border border-border bg-card/40 p-5">
                <span className="text-xs text-muted-foreground">In pipeline (pending)</span>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-cyan-electric">${roi.pipeline.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">value at stake, awaiting outcome</p>
              </div>
              <div className="rounded-2xl border border-border bg-card/40 p-5">
                <span className="text-xs text-muted-foreground">Win rate</span>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{roi.winRate}%</p>
                <p className="text-[11px] text-muted-foreground">of {roi.resolved} resolved outcomes</p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-border bg-card/40 backdrop-blur">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="flex items-center gap-2 font-display font-semibold">
                  <DollarSign className="h-4 w-4 text-cyan-electric" /> Attributed outcomes
                </h2>
                <span className="text-xs text-muted-foreground">Confirm what paid off — that&rsquo;s your realized ROI</span>
              </div>
              {outcomes.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                  As agents send actions with money at stake, they&rsquo;ll appear here to track and confirm.
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {outcomes.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display font-semibold tabular-nums text-cyan-electric">${o.value.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground">{o.agent} · {o.createdAt}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{o.detail}</p>
                      </div>
                      {o.status === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => resolveOutcome(o.id, "won")}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/10"
                          >
                            <Check className="h-3 w-3" /> Won
                          </button>
                          <button
                            onClick={() => resolveOutcome(o.id, "lost")}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-white/5"
                          >
                            <X className="h-3 w-3" /> Lost
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            o.status === "won" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-muted-foreground"
                          }`}
                        >
                          {o.status}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {props.benchmarks && (
              <div className="mt-6 rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-display font-semibold">
                    <ArrowUpRight className="h-4 w-4 text-cyan-electric" /> How you compare
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {props.benchmarks.industry} · {props.benchmarks.sampleSize} anonymized peers
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {props.benchmarks.metrics.map((m) => {
                    const fmt = (n: number) => (m.unit === "$" ? `$${n.toLocaleString()}` : `${n}%`);
                    const ahead = m.you >= m.peers;
                    const max = Math.max(m.you, m.peers, 1);
                    return (
                      <div key={m.label} className="rounded-2xl border border-border/60 bg-card/30 p-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{m.label}</span>
                          <span className={ahead ? "text-emerald-300" : "text-yellow-300"}>
                            {ahead ? "ahead of peers" : "room to grow"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          <Bar label="You" value={m.you} max={max} display={fmt(m.you)} accent />
                          <Bar label="Peers" value={m.peers} max={max} display={fmt(m.peers)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "agents" && (
          <div className="rounded-3xl border border-border bg-card/40 backdrop-blur">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display font-semibold">
                  <Bot className="h-4 w-4 text-cyan-electric" /> Agents
                </h2>
                <span className="hidden text-xs text-muted-foreground sm:inline">Pause any agent — the kill switch</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-muted-foreground">
                  {isDemo ? "Run a cycle (sample):" : "Run a cycle on your data:"}
                </span>
                {RUNNERS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => run(r)}
                    disabled={running !== null}
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-electric/30 bg-cyan-electric/10 px-3 py-1 text-xs font-semibold text-cyan-electric transition hover:bg-cyan-electric/20 disabled:opacity-50"
                  >
                    {running === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            {configs.length > 0 && (
              <div className="border-b border-border px-6 py-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold">Configure agents</h3>
                  <span className="text-xs text-muted-foreground">
                    <span className="capitalize">{ent.label}</span> plan · {enabledCount}/{ent.maxAgents} active
                  </span>
                </div>
                <div className="space-y-2">
                  {configs.map((c) => {
                    const canToggle = c.enabled || enabledCount < ent.maxAgents;
                    return (
                      <div key={c.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/30 px-4 py-2.5">
                        <span className="min-w-0 flex-1 text-sm font-medium">{c.name}</span>
                        <button
                          onClick={() => updateConfig(c.key, { enabled: !c.enabled })}
                          disabled={!canToggle}
                          title={!canToggle ? `Upgrade to enable more than ${ent.maxAgents} agents` : undefined}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-40 ${
                            c.enabled ? "border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10" : "border-border text-muted-foreground hover:bg-white/5"
                          }`}
                        >
                          {c.enabled ? "On" : "Off"}
                        </button>
                        <button
                          onClick={() => updateConfig(c.key, { autoSend: !c.autoSend })}
                          title="Auto-send executes without approval"
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            c.autoSend ? "border-cyan-electric/30 text-cyan-electric hover:bg-cyan-electric/10" : "border-border text-muted-foreground hover:bg-white/5"
                          }`}
                        >
                          {c.autoSend ? "Auto-send" : "Approve first"}
                        </button>
                        <select
                          value={c.schedule}
                          onChange={(e) => updateConfig(c.key, { schedule: e.target.value as Schedule })}
                          className="rounded-lg border border-border bg-card/60 px-2 py-1 text-xs outline-none focus:border-cyan-electric"
                        >
                          {(["manual", "daily", "hourly", "off"] as Schedule[]).map((s) => (
                            <option key={s} value={s} disabled={!ent.schedules.includes(s)}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              {agents.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No agents yet — they&rsquo;ll appear here as we build and launch them.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 text-left font-medium">Agent</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Runs</th>
                      <th className="px-4 py-3 text-right font-medium">Success</th>
                      <th className="px-4 py-3 text-right font-medium">Saved</th>
                      <th className="px-4 py-3 text-right font-medium">Control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a) => (
                      <tr key={a.id} className="border-b border-border/50 last:border-0">
                        <td className="px-6 py-4 font-medium">{a.name}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              a.status === "active" ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-yellow-300"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${a.status === "active" ? "bg-emerald-400" : "bg-yellow-400"}`} />
                            {a.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-muted-foreground">{a.runs.toLocaleString()}</td>
                        <td className="px-4 py-4 text-right tabular-nums">{a.successRate}%</td>
                        <td className="px-4 py-4 text-right font-display font-semibold tabular-nums text-cyan-electric">
                          ${a.saved.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => toggleAgent(a)}
                            disabled={busy === a.id}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                              a.status === "active"
                                ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                                : "border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10"
                            }`}
                          >
                            {a.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            {a.status === "active" ? "Pause" : "Resume"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "approvals" && (
          <div className="rounded-3xl border border-border bg-card/40 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="flex items-center gap-2 font-display font-semibold">
                <ClipboardCheck className="h-4 w-4 text-cyan-electric" /> Pending approvals
              </h2>
              <span className="text-xs text-muted-foreground">Agents draft — you approve before anything is sent</span>
            </div>
            {approvals.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                Nothing waiting — your agents are all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {approvals.map((a) => {
                  const isEditing = editing?.id === a.id;
                  return (
                    <li key={a.id} className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] text-cyan-electric">{a.action}</span>
                            <span className="text-xs text-muted-foreground">
                              {a.agent} · {a.createdAt}
                            </span>
                          </div>
                          <p className="mt-1 text-sm">{a.summary}</p>
                        </div>
                        <div className="flex gap-2">
                          {a.draft && (
                            <button
                              onClick={() => setEditing(isEditing ? null : { id: a.id, text: a.draft ?? "" })}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-white/5"
                            >
                              {isEditing ? "Close" : "Edit"}
                            </button>
                          )}
                          <button
                            onClick={() => decide(a, "approved", isEditing ? editing?.text : undefined)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/10"
                          >
                            <Check className="h-3 w-3" /> {isEditing ? "Save & approve" : "Approve"}
                          </button>
                          <button
                            onClick={() => decide(a, "rejected")}
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
                          >
                            <X className="h-3 w-3" /> Reject
                          </button>
                        </div>
                      </div>
                      {isEditing ? (
                        <textarea
                          value={editing?.text ?? ""}
                          onChange={(e) => setEditing({ id: a.id, text: e.target.value })}
                          rows={5}
                          className="mt-3 w-full rounded-xl border border-border bg-card/60 px-3 py-2 text-sm outline-none focus:border-cyan-electric"
                        />
                      ) : (
                        a.draft && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{a.draft}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {tab === "connections" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((c, i) => {
              const Icon = providerIcon(c.provider);
              return (
                <div key={i} className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-cyan-electric">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-medium">{c.provider}</span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        c.status === "connected"
                          ? "bg-emerald-400/10 text-emerald-300"
                          : c.status === "error"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-white/5 text-muted-foreground"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${c.status === "connected" ? "bg-emerald-400" : c.status === "error" ? "bg-red-400" : "bg-muted-foreground"}`} />
                      {c.status}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Scope: <span className="text-foreground">{c.scope}</span>
                  </p>
                  {(c.health === "expired" || c.health === "error") && c.reconnectHref && (
                    <a
                      href={c.reconnectHref}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-medium text-yellow-300 transition hover:bg-yellow-400/20"
                    >
                      <ArrowUpRight className="h-3 w-3" />
                      {c.health === "expired" ? "Reconnect — access expired" : "Reconnect"}
                    </a>
                  )}
                </div>
              );
            })}
            <Link
              href="/connections"
              className="flex items-center justify-center rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground transition hover:border-cyan-electric/40 hover:text-cyan-electric"
            >
              <Plug className="mr-2 h-4 w-4" /> Connect another tool
            </Link>
          </div>
        )}

        {tab === "audit" && (
          <div className="rounded-3xl border border-border bg-card/40 backdrop-blur">
            <div className="flex items-center gap-2 border-b border-border px-6 py-4 font-display font-semibold">
              <ShieldCheck className="h-4 w-4 text-cyan-electric" /> Governance audit log
            </div>
            {audit.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No governance events yet.</p>
            ) : (
              <ul className="divide-y divide-border/50">
                {audit.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3 text-sm">
                    <span className="text-xs text-muted-foreground tabular-nums">{a.time}</span>
                    <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] text-cyan-electric">{a.action}</span>
                    <span className="text-muted-foreground">{a.detail}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{a.actor}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {isDemo && (
          <div className="mt-10 rounded-3xl border border-cyan-electric/20 bg-cyan-electric/5 p-8 text-center">
            <Lock className="mx-auto h-8 w-8 text-cyan-electric" />
            <h3 className="mt-3 font-display text-xl font-semibold">{t("portal.demoTitle")}</h3>
            <p className="mt-1 text-muted-foreground">{t("portal.demoSub")}</p>
            <Link href="/pricing#quote">
              <Button className="mt-5" size="lg">
                {t("portal.getPortal")}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

function Bar({ label, value, max, display, accent }: { label: string; value: number; max: number; display: string; accent?: boolean }) {
  const pct = Math.max(3, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${accent ? "bg-cyan-electric" : "bg-muted-foreground/40"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right tabular-nums">{display}</span>
    </div>
  );
}

function TabButton({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
        active ? "bg-cyan-electric text-navy-900" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function SignOutButton() {
  async function signOut() {
    try {
      await createClient().auth.signOut();
    } catch {
      /* no-op */
    }
    window.location.href = "/portal";
  }
  return (
    <Button variant="outline" size="sm" onClick={signOut} className="ml-auto">
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </Button>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-cyan-electric" />
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {delta && <p className="text-[11px] text-emerald-300">{delta} vs last month</p>}
    </motion.div>
  );
}
