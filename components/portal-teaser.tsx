"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Activity, ArrowUpRight, Bot, CheckCircle2, Clock } from "lucide-react";
import { SectionHeader } from "@/components/services";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";

const runs = [
  { name: "Inbox triage", status: "ok", last: "42s ago", runs: 1284, saved: "$214" },
  { name: "Lead qualifier", status: "ok", last: "2m ago", runs: 318, saved: "$96" },
  { name: "Review replies", status: "ok", last: "8m ago", runs: 57, saved: "$34" },
  { name: "Cart recovery", status: "warn", last: "11m ago", runs: 41, saved: "$128" },
  { name: "Booking agent", status: "ok", last: "just now", runs: 72, saved: "$1,200" },
];

export function PortalTeaser() {
  const { t } = useLocale();
  return (
    <section className="relative py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow={t("prt.teaserEyebrow")}
          title={
            <>
              {t("portal.watchTitle.1")} <span className="gradient-text">{t("portal.watchTitle.2")}</span>
            </>
          }
          sub={t("portal.watchSub")}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="relative mt-14 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-navy-900/60 to-navy-950/60 p-2 shadow-glow-lg backdrop-blur-xl"
        >
          <div className="flex items-center justify-between rounded-t-[22px] border border-white/10 bg-white/[0.03] px-5 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-cyan-electric/15">
                <Bot className="h-3.5 w-3.5 text-cyan-electric" />
              </span>
              <span className="font-medium">Wardvale Portal</span>
              <span className="text-muted-foreground">· Demo Bistro</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {t("prt.live")}
            </div>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3 lg:col-span-1 lg:grid-cols-1">
              <KPI icon={Activity} label={t("prt.teaserRunsToday")} value="1,772" delta="+12%" />
              <KPI icon={Clock} label={t("portal.hoursSaved")} value="37.4h" delta="+4h" />
              <KPI icon={CheckCircle2} label={t("prt.teaserSuccessRate")} value="99.2%" delta="+0.3%" />
              <KPI icon={ArrowUpRight} label={t("portal.roiMonth")} value="$3,412" delta="+$480" />
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-white/10 bg-navy-950/40">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{t("portal.activeAutomations")}</span>
                  <span>{t("prt.teaserRunsSaved")}</span>
                </div>
                <ul>
                  {runs.map((r, i) => (
                    <motion.li
                      key={r.name}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      viewport={{ once: true }}
                      className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-3 text-sm last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            r.status === "ok"
                              ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
                              : "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.7)]"
                          }`}
                        />
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-muted-foreground">· {r.last}</span>
                      </div>
                      <div className="flex items-center gap-4 tabular-nums">
                        <span className="text-muted-foreground">{r.runs.toLocaleString()}</span>
                        <span className="w-16 text-right font-display font-semibold text-cyan-electric">
                          {r.saved}
                        </span>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-8 text-center">
          <Link href="/portal">
            <Button variant="secondary" size="lg">{t("portal.preview")}</Button>
          </Link>
        </div>
      </div>
    </section>
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
  delta: string;
}) {
  const { t } = useLocale();
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-cyan-electric" />
      </div>
      <p className="mt-2 font-display text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-emerald-300">{delta} {t("prt.vsLastWeek")}</p>
    </div>
  );
}
