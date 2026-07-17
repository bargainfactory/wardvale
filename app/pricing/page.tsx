"use client";

import { motion } from "framer-motion";
import { useMounted } from "@/lib/use-mounted";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { PageLayout } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StartFlow } from "@/components/start-experience/start-flow";
import { useStartExperience } from "@/components/start-experience/provider";
import { FAQ } from "@/components/faq";
import { GuaranteeBanner } from "@/components/guarantee";
import { track, getVariant } from "@/lib/analytics";

// Growth price experiment: variant A = $2,000, variant B = $2,500.
const GROWTH_PRICE_B = 2500;
function growthPriceFor(variant: "A" | "B", base: number) {
  return variant === "B" ? GROWTH_PRICE_B : base;
}
import { tiers } from "@/lib/data";
import { cn, formatCurrency } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";

export default function PricingPage() {
  const { t } = useLocale();
  const mounted = useMounted();
  const { open: openStart } = useStartExperience();

  // Sticky per-visitor variant; server + first client render use "A" (no
  // hydration mismatch), then we resolve the real variant after mount.
  const [growthVariant, setGrowthVariant] = useState<"A" | "B">("A");
  useEffect(() => {
    const v = getVariant("growth_price");
    setGrowthVariant(v);
    track("pricing_view", { growth_variant: v, growth_price: growthPriceFor(v, 2000) });
  }, []);
  const priceFor = (tier: { id: string; price: number }) =>
    tier.id === "growth" ? growthPriceFor(growthVariant, tier.price) : tier.price;

  // Billing cycle. Annual = 2 months free (pay 10), shown as the effective /mo.
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const displayPrice = (tier: { id: string; price: number }) =>
    cycle === "annual" ? Math.round((priceFor(tier) * 10) / 12) : priceFor(tier);

  useEffect(() => {
    if (window.location.hash === "#quote") {
      setTimeout(() => {
        document.getElementById("quote")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, []);

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
            <Badge className="mb-6">{t("pricing.eyebrow")}</Badge>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.1]">
              {t("pricing.title.1")} <span className="gradient-text">{t("pricing.title.2")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {t("pricing.page.sub")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="pb-20">
        <div className="container">
          {/* Monthly / annual toggle */}
          <div className="mb-8 flex items-center justify-center">
            <div className="inline-flex rounded-full border border-border bg-card/50 p-1 text-sm">
              {(["monthly", "annual"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  aria-pressed={cycle === c}
                  className={cn(
                    "rounded-full px-4 py-1.5 transition-colors",
                    cycle === c ? "bg-cyan-electric font-medium text-navy-900" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(c === "monthly" ? "pricing.monthly" : "pricing.annual")}
                  {c === "annual" && (
                    <span className="ml-1.5 rounded-full bg-navy-900/15 px-1.5 py-0.5 text-[10px] font-semibold">
                      {t("pricing.save2mo")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.id}
                initial={mounted ? { opacity: 0, y: 24 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={cn(
                  "relative flex flex-col rounded-3xl p-8",
                  tier.highlighted
                    ? "gradient-border glass-strong shadow-glow-lg scale-[1.02]"
                    : "glass"
                )}
              >
                {tier.highlighted && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-cyan-electric to-indigo-400 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-navy-900">
                    <Sparkles className="h-3 w-3" /> {t("pricing.mostPopular")}
                  </span>
                )}

                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
                  {t(`tier.${tier.id}.tag`)}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold">{t(`tier.${tier.id}.name`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`tier.${tier.id}.blurb`)}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-display text-5xl font-semibold tabular-nums">
                    ${displayPrice(tier).toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">{t("pricing.perMonth")}</span>
                </div>
                {cycle === "annual" && (
                  <p className="mt-1 text-xs text-muted-foreground">{t("pricing.billedAnnually")}</p>
                )}

                {/* Value / ROI badge */}
                <div className="mt-4 rounded-xl border border-cyan-electric/30 bg-cyan-electric/[0.08] p-3">
                  <p className="text-sm text-muted-foreground">
                    {t("pricing.valueSaves")}{" "}
                    <span className="font-display font-semibold text-cyan-electric tabular-nums">
                      ~${tier.typicalSavings.toLocaleString()}/mo
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    ≈ {(tier.typicalSavings / priceFor(tier)).toFixed(1)}× {t("pricing.valueReturn")} ·{" "}
                    {t("pricing.valuePayback")} ~{Math.round((priceFor(tier) / tier.typicalSavings) * 30)}{" "}
                    {t("pricing.valueDays")}
                  </p>
                </div>

                <ul className="mt-6 space-y-3">
                  {tier.features.map((_, fi) => (
                    <li key={fi} className="flex gap-3 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-electric" />
                      <span>{t(`tier.${tier.id}.f${fi + 1}`)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  <Button
                    variant={tier.highlighted ? "primary" : "outline"}
                    className="w-full"
                    onClick={() => startCheckout(tier.id, tier.id === "growth" ? growthVariant : undefined, cycle)}
                  >
                    {t("pricing.start")} {t(`tier.${tier.id}.name`)}
                  </Button>
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    {t("pricing.onboarding")}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Enterprise — custom pricing */}
          <div className="mx-auto mt-5 max-w-5xl">
            <div className="flex flex-col items-center justify-between gap-4 rounded-3xl gradient-border glass-strong p-7 text-center sm:flex-row sm:text-left">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
                  {t("pricing.enterprise.tag")}
                </p>
                <h3 className="mt-1 font-display text-xl font-semibold">
                  {t("pricing.enterprise.name")}{" "}
                  <span className="text-muted-foreground">— {t("pricing.enterprise.price")}</span>
                </h3>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {t("pricing.enterprise.blurb")}
                </p>
              </div>
              <Button variant="outline" size="lg" onClick={() => openStart()}>
                {t("pricing.enterprise.cta")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Comparison table */}
          <div className="mx-auto mt-16 max-w-5xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pr-6 font-medium">{t("compare.feature")}</th>
                  {tiers.map((tier) => (
                    <th key={tier.id} className="pb-3 text-center font-medium">
                      {t(`tier.${tier.id}.name`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [t("compare.automations"), "1", "Up to 5", "Unlimited"],
                  [t("compare.agents"), "—", "1", "2 + voice"],
                  [t("compare.optimization"), "Monthly", "Weekly", "Continuous"],
                  [t("compare.sla"), "48h", "12h", "Same-day"],
                  [t("compare.engineer"), "—", "—", "✓"],
                  [t("compare.portal"), "✓", "✓", "✓"],
                  [t("compare.roi"), "—", "Monthly", "Live dashboard"],
                  [t("compare.training"), "—", "1 session", "Unlimited"],
                  [t("compare.strategy"), "—", "—", "Quarterly"],
                ].map(([feature, ...vals]) => (
                  <tr key={feature} className="border-b border-border/50">
                    <td className="py-3 pr-6 text-muted-foreground">{feature}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="py-3 text-center">
                        {v === "✓" ? (
                          <Check className="mx-auto h-4 w-4 text-cyan-electric" />
                        ) : v === "—" ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          v
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ROI guarantee */}
      <section className="pb-16">
        <div className="container">
          <GuaranteeBanner />
        </div>
      </section>

      {/* Retainer calculator */}
      <section id="calculator" className="scroll-mt-28 pb-20">
        <div className="container">
          <RetainerCalculator />
        </div>
      </section>

      {/* Tailored automation experience (consolidated funnel — replaces the old quote form) */}
      <section id="quote" className="relative py-24 lg:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl gradient-border glass-strong overflow-hidden rounded-3xl">
            <StartFlow />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQ />

      {/* Final CTA */}
      <section className="py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <h2 className="font-display text-3xl font-semibold">
              {t("pricing.stillDeciding")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("pricing.stillSub")}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/results">
                <Button size="lg">
                  {t("pricing.viewCases")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/process">
                <Button variant="secondary" size="lg">{t("pricing.seeHow")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

async function startCheckout(tierId: string, variant?: "A" | "B", cycle: "monthly" | "annual" = "monthly") {
  track("checkout_click", {
    tier: tierId,
    cycle,
    ...(tierId === "growth" ? { growth_variant: variant, growth_price: growthPriceFor(variant ?? "A", 2000) } : {}),
  });
  try {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier: tierId, variant, cycle }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Checkout unavailable. Try again shortly.");
  } catch {
    alert("Checkout unavailable. Try again shortly.");
  }
}

function RetainerCalculator() {
  const { t } = useLocale();
  const [hoursPerWeek, setHoursPerWeek] = useState(20);
  const [hourlyCost, setHourlyCost] = useState(35);
  const [tasks, setTasks] = useState(3);

  const monthlyWaste = useMemo(
    () => Math.round(hoursPerWeek * hourlyCost * 4.33 * (tasks / 3)),
    [hoursPerWeek, hourlyCost, tasks]
  );

  const suggestedTier =
    monthlyWaste < 2500 ? tiers[0] : monthlyWaste < 7000 ? tiers[1] : tiers[2];
  const netGain = monthlyWaste - suggestedTier.price;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="gradient-border glass-strong overflow-hidden rounded-3xl p-8 md:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
              {t("calc.eyebrow")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold">
              {t("calc.title")}
            </h3>
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-3">
            <Slider label={t("calc.hours")} min={2} max={80} step={1} value={hoursPerWeek} onChange={setHoursPerWeek} format={(v) => `${v} h`} />
            <Slider label={t("calc.cost")} min={15} max={120} step={1} value={hourlyCost} onChange={setHourlyCost} format={(v) => `$${v}`} />
            <Slider label={t("calc.processes")} min={1} max={10} step={1} value={tasks} onChange={setTasks} format={(v) => `${v}`} />
          </div>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Result label={t("calc.waste")} value={formatCurrency(monthlyWaste)} />
          <Result label={t("calc.suggested")} value={t(`tier.${suggestedTier.id}.name`)} sub={`${formatCurrency(suggestedTier.price)}/mo`} highlight />
          <Result label={t("calc.netGain")} value={netGain > 0 ? `+${formatCurrency(netGain)}` : formatCurrency(netGain)} sub={`${Math.max(0, Math.round((netGain / Math.max(suggestedTier.price, 1)) * 100))}% ROI`} />
        </div>
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, format }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-display text-sm text-foreground tabular-nums">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-electric" />
    </label>
  );
}

function Result({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-5", highlight ? "border-cyan-electric/40 bg-cyan-electric/10" : "border-border bg-card/40")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-semibold tabular-nums", highlight && "gradient-text")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
