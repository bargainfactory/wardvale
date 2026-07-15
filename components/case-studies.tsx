"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { caseStudies } from "@/lib/data";
import { SectionHeader } from "@/components/services";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";

export function CaseStudies() {
  const { t } = useLocale();
  const [active, setActive] = useState(caseStudies[0].id);
  const current = caseStudies.find((c) => c.id === active)!;

  return (
    <section id="results" className="relative py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow="Case studies"
          title={
            <>
              Real dollars. <span className="gradient-text">Real hours back.</span>
            </>
          }
          sub="Four verticals, four months post-launch, measured in the client's own dashboards."
        />

        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-2">
          {caseStudies.map((c) => {
            const Icon = c.icon;
            const isActive = c.id === active;
            return (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                  isActive
                    ? "border-cyan-electric/40 bg-cyan-electric/10 text-cyan-electric shadow-glow"
                    : "border-border text-muted-foreground hover:border-cyan-electric/30 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {t(c.vertical)}
              </button>
            );
          })}
        </div>

        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-10 grid gap-6 lg:grid-cols-5"
        >
          <div className="lg:col-span-2">
            <div className="gradient-border glass relative h-full overflow-hidden rounded-3xl p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-electric">
                {t(current.vertical)}
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold">
                {current.company}
              </h3>
              <p className="mt-3 text-muted-foreground">{t(current.headline)}</p>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <Metric label="Saved / month" value={t(current.savings)} accent />
                <Metric label="Hours back / month" value={`${current.hoursPerMonth}h`} />
              </div>

              <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Live — data synced 2 min ago
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="grid gap-4 md:grid-cols-2">
              <BeforeAfterCard title="Before FlowForge" items={current.before} tone="before" />
              <BeforeAfterCard title="After FlowForge" items={current.after} tone="after" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-2xl font-semibold tracking-tight",
          accent && "gradient-text"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function BeforeAfterCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: { label: string; value: string }[];
  tone: "before" | "after";
}) {
  const { t } = useLocale();
  return (
    <div
      className={cn(
        "rounded-3xl border p-6",
        tone === "before"
          ? "border-border bg-card/40"
          : "gradient-border glass bg-cyan-electric/[0.03]"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            tone === "before"
              ? "bg-red-400/10 text-red-300"
              : "bg-emerald-400/10 text-emerald-300"
          )}
        >
          {tone === "before" ? "Baseline" : "Post-launch"}
        </span>
      </div>
      <dl className="mt-5 space-y-3">
        {items.map((i) => (
          <div key={i.label} className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0">
            <dt className="text-sm text-muted-foreground">{t(i.label)}</dt>
            <dd className="font-display text-lg font-semibold tabular-nums">{i.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
