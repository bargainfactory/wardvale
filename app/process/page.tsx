"use client";

import { motion } from "framer-motion";
import { useMounted } from "@/lib/use-mounted";
import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { PageLayout } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { steps } from "@/lib/data";
import { useLocale } from "@/lib/locale-context";
import { useStartExperience } from "@/components/start-experience/provider";

export default function ProcessPage() {
  const { t } = useLocale();
  const mounted = useMounted();
  const { open: openStart } = useStartExperience();

  const turnarounds = [t("step.1.time"), t("step.2.time"), t("step.3.time"), t("step.4.time"), t("step.5.time")];
  const details = [t("step.1.detail"), t("step.2.detail"), t("step.3.detail"), t("step.4.detail"), t("step.5.detail")];

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
            <Badge className="mb-6">{t("process.eyebrow")}</Badge>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.1]">
              {t("process.title.1")} <span className="gradient-text">{t("process.title.2")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {t("process.page.sub")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Timeline */}
      <section className="pb-24">
        <div className="container">
          <div className="relative mx-auto max-w-4xl">
            {/* Vertical line */}
            <div className="pointer-events-none absolute left-8 top-0 hidden h-full w-px bg-gradient-to-b from-cyan-electric/60 via-cyan-electric/20 to-transparent md:block" />

            <div className="space-y-12">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.n}
                    initial={mounted ? { opacity: 0, y: 28 } : false}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="relative grid gap-6 md:grid-cols-[64px_1fr] md:gap-8"
                  >
                    {/* Step number */}
                    <div className="flex items-start justify-center">
                      <span className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric to-indigo-400 font-display text-xl font-semibold text-navy-900 shadow-glow">
                        {s.n}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="gradient-border glass rounded-3xl p-8">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5">
                          <Icon className="h-5 w-5 text-cyan-electric" />
                        </div>
                        <h2 className="font-display text-2xl font-semibold">{t(`step.${s.n}.title`)}</h2>
                        <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {turnarounds[i]}
                        </div>
                      </div>

                      <p className="mt-4 text-muted-foreground">{t(`step.${s.n}.desc`)}</p>
                      <p className="mt-3 text-sm text-muted-foreground/80">{details[i]}</p>

                      {i === steps.length - 1 && (
                        <div className="mt-6">
                          <Link href="/pricing">
                            <Button>
                              {t("process.seeRetainers")}
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Guarantee */}
      <section className="border-y border-border/60 py-16">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold">
              {t("guarantee.title.1")} <span className="gradient-text">{t("guarantee.title.2")}</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              {t("guarantee.sub")}
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              { label: t("guarantee.stat1.label"), value: t("guarantee.stat1.value") },
              { label: t("guarantee.stat2.label"), value: t("guarantee.stat2.value") },
              { label: t("guarantee.stat3.label"), value: t("guarantee.stat3.value") },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border bg-card/40 p-5 text-center"
              >
                <p className="font-display text-2xl font-semibold gradient-text">{s.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <h2 className="font-display text-3xl font-semibold">
              {t("guarantee.discoveryCta")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("guarantee.discoverySub")}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" onClick={() => openStart()}>
                {t("cta.getAudit")}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Link href="/pricing">
                <Button variant="secondary" size="lg">{t("pricing.viewDetails")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
