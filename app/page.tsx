"use client";

import { motion } from "framer-motion";
import { useMounted } from "@/lib/use-mounted";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Inbox,
  Play,
  Sparkles,
  Mail,
  Mic,
  Calendar,
  Star,
  Phone,
  MessageCircle,
  TrendingUp,
  Utensils,
  ShoppingBag,
  Briefcase,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageLayout } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { testimonials, trustBadges, tiers } from "@/lib/data";
import { useLocale } from "@/lib/locale-context";
import { getVariant } from "@/lib/analytics";
import { WorkflowBuilder } from "@/components/workflow-builder";
import { GuaranteeBanner } from "@/components/guarantee";
import { ProvenImpact } from "@/components/proven-impact";

const resultTeasers = [
  { icon: Utensils, vertical: "Restaurant", saved: "$3,400/mo", hours: "76h" },
  { icon: ShoppingBag, vertical: "E-commerce", saved: "$7,200/mo", hours: "48h" },
  { icon: Briefcase, vertical: "Consulting", saved: "$5,600/mo", hours: "60h" },
  { icon: Wrench, vertical: "Local services", saved: "$4,800/mo", hours: "40h" },
];

export default function Home() {
  const { t } = useLocale();
  const mounted = useMounted();

  // Keep the Growth teaser price consistent with the /pricing A/B test.
  const [growthVariant, setGrowthVariant] = useState<"A" | "B">("A");
  useEffect(() => {
    setGrowthVariant(getVariant("growth_price"));
  }, []);

  const workflow = [
    { icon: Mail, label: t("workflow.step1"), sub: t("workflow.step1.sub"), accent: "from-cyan-electric/20 to-cyan-electric/5" },
    { icon: Bot, label: t("workflow.step2"), sub: t("workflow.step2.sub"), accent: "from-indigo-500/20 to-indigo-500/5" },
    { icon: Calendar, label: t("workflow.step3"), sub: t("workflow.step3.sub"), accent: "from-emerald-400/20 to-emerald-400/5" },
  ];

  const serviceCards = [
    { icon: Sparkles, title: "Lead Capture", sub: "↑ 38% reply rate" },
    { icon: Phone, title: "Voice Receptionist", sub: "0 missed calls" },
    { icon: MessageCircle, title: "WhatsApp Agent", sub: "90%+ open rate" },
    { icon: Inbox, title: "Inbox Triage", sub: "↓ 82% inbox time" },
    { icon: TrendingUp, title: "Sales Follow-up", sub: "3x follow-up" },
    { icon: Bot, title: "Custom Agents", sub: "$1,200+/mo saved" },
  ];
  return (
    <PageLayout>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden pb-24 lg:pb-32">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-grid-glow dark:bg-mesh-dark" />

        <div className="container relative">
          <motion.div initial={mounted ? { opacity: 0, y: 20 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mx-auto max-w-3xl text-center">
            <Badge className="mb-6"><Sparkles className="h-3 w-3" />{t("hero.badge")}</Badge>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[64px] lg:leading-[1.05]">
              {t("hero.title.1")}{" "}
              <span className="gradient-text">{t("hero.title.2")}</span> {t("hero.title.3")}{" "}
              <span className="text-muted-foreground">{t("hero.title.4")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {t("hero.sub")} <span className="text-foreground font-medium">{t("hero.sub.price")}</span>.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="#builder">
                <Button size="lg">{t("hero.ctaPrimary")}<ArrowRight className="h-4 w-4" /></Button>
              </Link>
              <Link href="/results">
                <Button variant="secondary" size="lg"><Play className="h-4 w-4" />{t("hero.ctaSecondary")}</Button>
              </Link>
            </div>
            <Link
              href="/build"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-cyan-electric transition hover:gap-2"
            >
              <Mic className="h-3.5 w-3.5" /> Or describe your workflow by voice
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <p className="mt-4 text-xs text-muted-foreground">
              {t("hero.trust")}
            </p>
          </motion.div>

          {/* Animated workflow demo */}
          <motion.div initial={mounted ? { opacity: 0, y: 40 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative mx-auto mt-16 max-w-5xl">
            <div className="gradient-border relative overflow-hidden rounded-3xl glass-strong shadow-glow">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-cyan-electric" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-electric" />
                  </span>
                  {t("workflow.liveDemo")}
                </div>
                <span className="text-xs text-muted-foreground">{t("workflow.autoplay")}</span>
              </div>
              <div className="relative p-8 md:p-12">
                <div className="grid gap-4 md:grid-cols-3">
                  {workflow.map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0.3, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: i * 0.25, repeat: Infinity, repeatType: "reverse", repeatDelay: 2 }}
                        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${step.accent} p-5`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 backdrop-blur">
                            <Icon className="h-5 w-5 text-cyan-electric" />
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Step {i + 1}</span>
                        </div>
                        <p className="mt-4 font-medium">{step.label}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{step.sub}</p>
                        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5">
                          <motion.div className="h-full bg-gradient-to-r from-cyan-electric to-indigo-400" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.6, delay: i * 0.5, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm md:flex-row">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                    {t("workflow.completed")} <span className="text-foreground font-medium">1.8s</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{t("workflow.leads")} <span className="text-foreground font-medium tabular-nums">142</span></span>
                    <span>·</span>
                    <span>{t("workflow.hours")} <span className="text-foreground font-medium tabular-nums">37.4</span></span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Trust logos */}
          <div className="mt-16 flex flex-col items-center gap-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("hero.stackTrust")}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 opacity-70">
              {["Zapier", "OpenAI", "Stripe", "HubSpot", "Shopify", "Calendly"].map((l) => (
                <span key={l} className="font-display text-lg font-semibold tracking-tight text-muted-foreground">{l}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Proven impact (real aggregates; hides until there's data) ─── */}
      <section className="container -mt-6 pb-4">
        <ProvenImpact />
      </section>

      {/* ─── Live builder (hero experience) ─── */}
      <section id="builder" className="relative border-y border-border/60 py-20 lg:py-28">
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark opacity-60" />
        <div className="container relative">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">See it before you buy</span>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Describe a workflow. <span className="gradient-text">Watch us scope it live.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              No sales call, no black box. Tell our agent what eats your time — by text or voice — and
              see the exact automation, the flow, and the ROI in 60 seconds.
            </p>
          </div>
          <div className="mt-10">
            <WorkflowBuilder />
          </div>
        </div>
      </section>

      {/* ─── Services teaser ─── */}
      <section className="py-24 lg:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">{t("services.eyebrow")}</span>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("services.title.1")} <span className="gradient-text">{t("services.title.2")}</span>
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {serviceCards.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div key={i} initial={mounted ? { opacity: 0, y: 20 } : false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                  <Link href="/services" className="group block rounded-3xl glass p-6 transition hover:-translate-y-1 hover:shadow-glow">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric/25 to-indigo-500/15 text-cyan-electric">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-cyan-electric">{s.sub}</p>
                    <div className="mt-4 flex items-center gap-1 text-sm text-muted-foreground group-hover:text-cyan-electric">
                      {t("services.learnMore")} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Results teaser ─── */}
      <section className="py-24 lg:py-32 border-y border-border/60">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">{t("results.eyebrow")}</span>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("results.title.1")} <span className="gradient-text">{t("results.title.2")}</span>
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {resultTeasers.map((r, i) => {
              const Icon = r.icon;
              return (
                <motion.div key={i} initial={mounted ? { opacity: 0, y: 20 } : false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                  <Link href="/results" className="group block rounded-3xl glass p-6 transition hover:-translate-y-1 hover:shadow-glow">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-cyan-electric" />
                      <span className="text-sm font-medium text-muted-foreground">{r.vertical}</span>
                    </div>
                    <p className="mt-4 font-display text-2xl font-semibold gradient-text">{r.saved}</p>
                    <p className="text-sm text-muted-foreground">{r.hours} saved / month</p>
                    <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground group-hover:text-cyan-electric">
                      {t("results.readCase")} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Process teaser ─── */}
      <section className="py-24 lg:py-32">
        <div className="container">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">{t("process.eyebrow")}</span>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Discovery to scale in <span className="gradient-text">14 days.</span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                {t("process.sub")}
              </p>
              <div className="mt-6">
                <Link href="/process">
                  <Button size="lg">{t("process.seeFull")}<ArrowRight className="h-4 w-4" /></Button>
                </Link>
              </div>
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((step, i) => (
                <motion.div
                  key={step}
                  initial={mounted ? { opacity: 0, x: 20 } : false}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-4 rounded-2xl glass p-4"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-electric to-indigo-400 font-display text-sm font-semibold text-navy-900">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{t(`step.${i + 1}.title`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(`step.${i + 1}.short`)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing teaser ─── */}
      <section className="py-24 lg:py-32 border-y border-border/60">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">{t("pricing.eyebrow")}</span>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("pricing.title.1")} <span className="gradient-text">{t("pricing.title.2")}</span>
            </h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-3">
            {tiers.map((tier, i) => (
              <motion.div key={tier.id} initial={mounted ? { opacity: 0, y: 20 } : false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                <Link href="/pricing" className={`group block rounded-3xl p-7 transition hover:-translate-y-1 ${tier.highlighted ? "gradient-border glass-strong shadow-glow" : "glass"}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">{t(`tier.${tier.id}.tag`)}</p>
                  <h3 className="mt-1 font-display text-xl font-semibold">{t(`tier.${tier.id}.name`)}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-semibold tabular-nums">${(tier.id === "growth" && growthVariant === "B" ? 2500 : tier.price).toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">{t("pricing.perMo")}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-cyan-electric tabular-nums">
                    {t("pricing.valueSaves")} ~${tier.typicalSavings.toLocaleString()}/mo
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{t(`tier.${tier.id}.blurb`)}</p>
                  <div className="mt-4 flex items-center gap-1 text-sm text-muted-foreground group-hover:text-cyan-electric">
                    {t("pricing.viewDetails")} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="py-24 lg:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">{t("testimonials.eyebrow")}</span>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("testimonials.title.1")} <span className="gradient-text">{t("testimonials.title.2")}</span>
            </h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2">
            {testimonials.map((tm, i) => (
              <motion.blockquote key={i} initial={mounted ? { opacity: 0, y: 16 } : false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="glass rounded-3xl p-7">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mt-3 text-muted-foreground">&ldquo;{t(`testimonial.${i + 1}.quote`)}&rdquo;</p>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{t(`testimonial.${i + 1}.name`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`testimonial.${i + 1}.role`)}, {t(`testimonial.${i + 1}.company`)}</p>
                  </div>
                  <span className="rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1 text-sm font-semibold text-cyan-electric tabular-nums">{tm.metric}</span>
                </div>
              </motion.blockquote>
            ))}
          </div>
          <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-3">
            {trustBadges.map((b) => (
              <span key={b} className="rounded-full border border-border bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground">{t(b)}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ROI guarantee ─── */}
      <section className="py-12">
        <div className="container">
          <GuaranteeBanner />
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <h2 className="font-display text-3xl font-semibold">
              {t("cta.ready")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("cta.readySub")}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/pricing#quote">
                <Button size="lg">{t("cta.getAudit")}<ArrowRight className="h-4 w-4" /></Button>
              </Link>
              <Link href="/process">
                <Button variant="secondary" size="lg">{t("cta.seeHow")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
