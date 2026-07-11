"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageLayout } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { services } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";

const toneColor: Record<string, string> = {
  zap: "bg-cyan-electric/15 text-cyan-electric border-cyan-electric/30",
  ai: "bg-indigo-400/15 text-indigo-300 border-indigo-400/30",
  crm: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  pay: "bg-fuchsia-400/15 text-fuchsia-300 border-fuchsia-400/30",
};

const serviceKeys: Record<string, string> = {
  "lead-capture": "lead",
  "onboarding": "onboarding",
  "email-triage": "inbox",
  "custom-agents": "custom",
};

export default function ServicesPage() {
  const { t } = useLocale();
  // Use a translation when present, else fall back to the literal from data.ts
  // (newer services ship English-only and rely on this fallback).
  const tf = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative overflow-hidden pb-20">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark" />
        <div className="container relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-3xl text-center"
          >
            <Badge className="mb-6">{t("services.eyebrow")}</Badge>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.1]">
              {t("services.title.1")} <span className="gradient-text">{t("services.title.2")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {t("services.page.sub")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Detailed service cards */}
      <section className="pb-24">
        <div className="container">
          <div className="space-y-16">
            {services.map((s, i) => {
              const Icon = s.icon;
              const sk = serviceKeys[s.id];
              return (
                <motion.article
                  key={s.id}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5 }}
                  className="grid items-center gap-8 lg:grid-cols-2"
                >
                  <div className={cn(i % 2 === 1 && "lg:order-2")}>
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric/25 to-indigo-500/15 text-cyan-electric">
                        <Icon className="h-5 w-5" strokeWidth={2.25} />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Service {i + 1}
                      </span>
                    </div>
                    <h2 className="mt-4 font-display text-3xl font-semibold">{tf(`service.${sk}.title`, s.title)}</h2>
                    <p className="mt-3 text-lg text-muted-foreground">{tf(`service.${sk}.desc`, s.description)}</p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      {s.outcomes.map((o, oi) => (
                        <span
                          key={oi}
                          className="rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1.5 text-sm font-medium text-cyan-electric"
                        >
                          {tf(`service.${sk}.outcome${oi + 1}`, o)}
                        </span>
                      ))}
                    </div>

                    <div className="mt-8">
                      <Link href="/pricing#quote">
                        <Button>
                          {t("services.cta")}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Flow preview */}
                  <div className={cn(i % 2 === 1 && "lg:order-1")}>
                    <div className="gradient-border glass overflow-hidden rounded-3xl p-6">
                      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>
                        {t("services.livePreview")}
                      </div>

                      <div className="space-y-3">
                        {s.flow.map((node, j) => (
                          <motion.div
                            key={j}
                            initial={{ opacity: 0.4, x: -12 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: j * 0.15 }}
                            viewport={{ once: false }}
                            className="flex items-center gap-3"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 font-display text-xs font-semibold text-muted-foreground">
                              {j + 1}
                            </span>
                            <div
                              className={cn(
                                "flex-1 rounded-xl border px-4 py-3 text-sm font-medium",
                                toneColor[node.tone]
                              )}
                            >
                              {tf(`service.${sk}.flow${j + 1}`, node.label)}
                            </div>
                            {j < s.flow.length - 1 && (
                              <div className="absolute left-[15px] ml-[1px] h-3 w-px bg-cyan-electric/30" />
                            )}
                          </motion.div>
                        ))}
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                        <span className="text-muted-foreground">{t("services.avgRun")}</span>
                        <span className="font-display font-semibold text-cyan-electric">1.8s</span>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Integration logos */}
      <section className="border-y border-border/60 py-16">
        <div className="container text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t("services.integrates")}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
            {["Zapier", "Make", "HubSpot", "Shopify", "Stripe", "Gmail", "Slack", "Calendly", "Notion", "Twilio", "OpenAI", "Airtable"].map(
              (l) => (
                <span key={l} className="font-display text-lg font-semibold tracking-tight text-muted-foreground">
                  {l}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <h2 className="font-display text-3xl font-semibold">
              {t("services.notSure")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("services.notSure.sub")}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/pricing#quote">
                <Button size="lg">
                  {t("cta.getAudit")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/results">
                <Button variant="secondary" size="lg">{t("cta.seeResults")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
