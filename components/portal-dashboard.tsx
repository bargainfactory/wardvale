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
  Users,
  X,
} from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/locale-context";
import type { PortalApproval, PortalAutomation, PortalAudit, PortalConnection, PortalKpis, PortalLog } from "@/lib/portal";

type Props = {
  clientName: string;
  kpis: PortalKpis;
  deltas?: { runs: string; hours: string; success: string; roi: string };
  automations: PortalAutomation[];
  logs: PortalLog[];
  connections: PortalConnection[];
  audit: PortalAudit[];
  approvals: PortalApproval[];
  isDemo: boolean;
  authEnabled: boolean;
  userEmail: string | null;
};

type Tab = "overview" | "agents" | "approvals" | "connections" | "audit";

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

// Sample inbox for the "Run a cycle" demo — a real reply, a promo, an angry
// customer, and a booking question, to show the agent's routing.
const SAMPLE_INBOX = [
  { from: "maria@events.com", subject: "Catering for 40 on the 22nd?", body: "Hi! Do you cater private events? We're a party of 40 on the 22nd." },
  { from: "no-reply@promos.com", subject: "🔥 50% off this weekend only", body: "Shop our biggest sale of the year. Unsubscribe anytime." },
  { from: "upset@customer.com", subject: "Terrible experience — I want a refund", body: "This was unacceptable and I want my money back now." },
  { from: "jon@acme.com", subject: "Are you open next Friday evening?", body: "Checking availability for a table next Friday." },
];

export function PortalDashboard(props: Props) {
  const { clientName, kpis, deltas, logs, connections, isDemo, authEnabled, userEmail } = props;
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("overview");
  const [agents, setAgents] = useState<PortalAutomation[]>(props.automations);
  const [audit, setAudit] = useState<PortalAudit[]>(props.audit);
  const [approvals, setApprovals] = useState<PortalApproval[]>(props.approvals);
  const [busy, setBusy] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Trigger one end-to-end agent cycle: read → decide (guarded, traced) → queue
  // approval-gated actions. Demonstrates the full secure loop live.
  async function runCycle() {
    setRunning(true);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: SAMPLE_INBOX }),
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
        { time: "just now", actor: "runtime", action: "agent.run", detail: `Inbox triage: ${data.decided ?? 0} decided, ${created.length} queued for approval` },
        ...log,
      ]);
      setTab("approvals");
    } catch {
      /* ignore */
    }
    setRunning(false);
  }

  async function decide(a: PortalApproval, decision: "approved" | "rejected") {
    setApprovals((list) => list.filter((x) => x.id !== a.id));
    setAudit((log) => [
      { time: "just now", actor: userEmail ?? "you", action: `approval.${decision}`, detail: a.summary },
      ...log,
    ]);
    if (!isDemo) {
      try {
        await fetch("/api/portal/approvals/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: a.id, decision }),
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

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-full border border-border bg-card/40 p-1 text-sm">
          <TabButton icon={LayoutDashboard} label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
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

        {tab === "agents" && (
          <div className="rounded-3xl border border-border bg-card/40 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="flex items-center gap-2 font-display font-semibold">
                <Bot className="h-4 w-4 text-cyan-electric" /> Agents
              </h2>
              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-muted-foreground sm:inline">Pause any agent — the kill switch</span>
                <button
                  onClick={runCycle}
                  disabled={running}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-electric/30 bg-cyan-electric/10 px-3 py-1 text-xs font-semibold text-cyan-electric transition hover:bg-cyan-electric/20 disabled:opacity-50"
                >
                  {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  {running ? "Running…" : "Run a cycle"}
                </button>
              </div>
            </div>
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
                {approvals.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
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
                      <button
                        onClick={() => decide(a, "approved")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/10"
                      >
                        <Check className="h-3 w-3" /> Approve
                      </button>
                      <button
                        onClick={() => decide(a, "rejected")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
                      >
                        <X className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  </li>
                ))}
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
