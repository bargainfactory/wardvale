"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  LineChart,
  Lock,
  LogOut,
  Settings,
} from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/locale-context";
import type { PortalAutomation, PortalKpis, PortalLog } from "@/lib/portal";

type Props = {
  clientName: string;
  kpis: PortalKpis;
  deltas?: { runs: string; hours: string; success: string; roi: string };
  automations: PortalAutomation[];
  logs: PortalLog[];
  isDemo: boolean;
  authEnabled: boolean;
  userEmail: string | null;
};

export function PortalDashboard({
  clientName,
  kpis,
  deltas,
  automations,
  logs,
  isDemo,
  authEnabled,
  userEmail,
}: Props) {
  const { t } = useLocale();

  return (
    <PageLayout>
      <div className="container pb-10">
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

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
            Dashboard · {clientName}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">{t("portal.dashTitle")}</h1>
          <p className="mt-1 text-muted-foreground">{t("portal.dashSub")}</p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPI icon={Activity} label={t("portal.runsMonth")} value={kpis.runs} delta={deltas?.runs} />
          <KPI icon={Clock} label={t("portal.hoursSaved")} value={kpis.hours} delta={deltas?.hours} />
          <KPI icon={CheckCircle2} label={t("portal.successRate")} value={kpis.success} delta={deltas?.success} />
          <KPI icon={ArrowUpRight} label={t("portal.roiMonth")} value={kpis.roi} delta={deltas?.roi} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-border bg-card/40 backdrop-blur">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="flex items-center gap-2 font-display font-semibold">
                  <Bot className="h-4 w-4 text-cyan-electric" />
                  {t("portal.activeAutomations")}
                </h2>
                <button className="grid h-8 w-8 place-items-center rounded-full border border-border transition hover:border-cyan-electric/40">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="overflow-x-auto">
                {automations.length === 0 ? (
                  <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                    No automations yet — they&rsquo;ll appear here as we build and launch them.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-6 py-3 text-left font-medium">Automation</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Runs</th>
                        <th className="px-4 py-3 text-right font-medium">Success</th>
                        <th className="px-4 py-3 text-right font-medium">Saved</th>
                        <th className="px-4 py-3 text-right font-medium">Last run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {automations.map((a) => (
                        <tr key={a.name} className="border-b border-border/50 last:border-0">
                          <td className="px-6 py-4 font-medium">{a.name}</td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                a.status === "active"
                                  ? "bg-emerald-400/10 text-emerald-300"
                                  : "bg-yellow-400/10 text-yellow-300"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${a.status === "active" ? "bg-emerald-400" : "bg-yellow-400"}`} />
                              {a.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-muted-foreground">{a.runs.toLocaleString()}</td>
                          <td className="px-4 py-4 text-right tabular-nums">{a.successRate}%</td>
                          <td className="px-4 py-4 text-right font-display font-semibold tabular-nums text-cyan-electric">${a.saved.toLocaleString()}</td>
                          <td className="px-4 py-4 text-right text-xs text-muted-foreground">{a.lastRun}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="rounded-3xl border border-border bg-card/40 backdrop-blur">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="flex items-center gap-2 font-display font-semibold">
                  <LineChart className="h-4 w-4 text-cyan-electric" />
                  {t("portal.liveLog")}
                </h2>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              </div>
              {logs.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">Run activity will stream here.</p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {logs.map((l, i) => (
                    <li key={i} className="px-5 py-3">
                      <p className="text-xs text-muted-foreground">{l.time}</p>
                      <p className="mt-0.5 text-sm">{l.event}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {isDemo && (
          <div className="mt-12 rounded-3xl border border-cyan-electric/20 bg-cyan-electric/5 p-8 text-center">
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
