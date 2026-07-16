"use client";

import { motion } from "framer-motion";
import { useMounted } from "@/lib/use-mounted";
import { ArrowRight } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { caseStudies, testimonials } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";
import { useStartExperience } from "@/components/start-experience/provider";

const caseKeys: Record<string, string> = {
  "nona-bistro": "nona",
  "terrafit": "terra",
  "northline-consult": "north",
  "pacific-plumb": "pacific",
};

export default function ResultsPage() {
  const { t } = useLocale();
  const mounted = useMounted();
  const { open: openStart } = useStartExperience();

  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative overflow-hidden pb-20">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark" />
        <div className="container relative">
          <motion.div
            initial={mounted ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-3xl text-center"
          >
            <Badge className="mb-6">{t("results.eyebrow")}</Badge>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.1]">
              {t("results.title.1")} <span className="gradient-text">{t("results.title.2")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {t("results.page.sub")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Aggregate stats */}
      <section className="pb-16">
        <div className="container">
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-4">
            {[
              { label: t("results.avgSavings"), value: "$5,250" },
              { label: t("results.avgHours"), value: "56h" },
              { label: t("results.avgROI"), value: "6.4×" },
              { label: t("results.retention"), value: "96%" },
            ].map((s) => (
              <motion.div
                key={s.label}
                initial={mounted ? { opacity: 0, y: 16 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-border bg-card/40 p-5 text-center backdrop-blur"
              >
                <p className="font-display text-3xl font-semibold gradient-text">{s.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Individual case studies */}
      <section className="pb-24">
        <div className="container">
          <div className="space-y-20">
            {caseStudies.map((cs) => {
              const Icon = cs.icon;
              const ck = caseKeys[cs.id];
              return (
                <motion.article
                  key={cs.id}
                  initial={mounted ? { opacity: 0, y: 32 } : false}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="grid gap-8 lg:grid-cols-5">
                    {/* Summary card */}
                    <div className="lg:col-span-2">
                      <div className="gradient-border glass sticky top-32 rounded-3xl p-8">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-electric/15 text-cyan-electric">
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            {t(`case.${ck}.vertical`)}
                          </span>
                        </div>
                        <h2 className="mt-4 font-display text-2xl font-semibold">
                          {t(`case.${ck}.company`)}
                        </h2>
                        <p className="mt-2 text-muted-foreground">{t(`case.${ck}.headline`)}</p>

                        <div className="mt-6 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-cyan-electric/30 bg-cyan-electric/10 p-4">
                            <p className="text-xs text-muted-foreground">{t("results.savedMo")}</p>
                            <p className="mt-1 font-display text-2xl font-semibold gradient-text">
                              {t(cs.savings)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border bg-card/40 p-4">
                            <p className="text-xs text-muted-foreground">{t("results.hoursMo")}</p>
                            <p className="mt-1 font-display text-2xl font-semibold">
                              {cs.hoursPerMonth}h
                            </p>
                          </div>
                        </div>

                        <div className="mt-6">
                          <Button className="w-full" onClick={() => openStart()}>
                            {t("results.getResults")}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Before / After */}
                    <div className="space-y-4 lg:col-span-3">
                      <BeforeAfterCard
                        title={t("results.before")}
                        baselineLabel={t("results.baseline")}
                        items={cs.before.map((item, j) => ({
                          label: t(`case.${ck}.b${j + 1}.label`),
                          value: item.value,
                        }))}
                        tone="before"
                      />
                      <BeforeAfterCard
                        title={t("results.after")}
                        baselineLabel={t("results.postLaunch")}
                        items={cs.after.map((item, j) => ({
                          label: t(`case.${ck}.b${j + 1}.label`),
                          value: item.value,
                        }))}
                        tone="after"
                      />

                      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/40 px-5 py-3 text-xs text-muted-foreground">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>
                        {t("results.liveSync")}
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-y border-border/60 py-20">
        <div className="container">
          <h2 className="text-center font-display text-3xl font-semibold">
            {t("results.whatClients")}
          </h2>
          <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
            {testimonials.map((tm, i) => (
              <motion.blockquote
                key={i}
                initial={mounted ? { opacity: 0, y: 16 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="glass rounded-3xl p-7"
              >
                <p className="text-muted-foreground">&ldquo;{t(tm.quote)}&rdquo;</p>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{tm.name}</p>
                    <p className="text-xs text-muted-foreground">{t(tm.role)}, {tm.company}</p>
                  </div>
                  <span className="rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1 text-sm font-semibold text-cyan-electric tabular-nums">
                    {tm.metric}
                  </span>
                </div>
              </motion.blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <h2 className="font-display text-3xl font-semibold">
              {t("results.joinThem")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("results.joinSub")}
            </p>
            <div className="mt-6">
              <Button size="lg" onClick={() => openStart()}>
                {t("cta.getAudit")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

function BeforeAfterCard({
  title,
  baselineLabel,
  items,
  tone,
}: {
  title: string;
  baselineLabel: string;
  items: { label: string; value: string }[];
  tone: "before" | "after";
}) {
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
          {baselineLabel}
        </span>
      </div>
      <dl className="mt-5 space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0"
          >
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="font-display text-lg font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
