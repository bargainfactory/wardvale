import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { GuaranteeBanner } from "@/components/guarantee";
import { OsConfigurator } from "@/components/os-configurator";
import { StartCTA } from "@/components/start-experience/start-cta";
import { bundles } from "@/lib/solutions";
import { getBenchmark } from "@/lib/benchmarks";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    title: t("sol.metaTitle"),
    description: t("sol.metaDesc"),
    alternates: { canonical: locale === "en" ? "/solutions" : `/${locale}/solutions` },
  };
}

export default async function SolutionsPage() {
  const { t } = await getT();
  return (
    <PageLayout>
      <section className="relative overflow-hidden pb-16 pt-4">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark" />
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">{t("sol.eyebrow")}</span>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {t("sol.heroTitle1")} <span className="gradient-text">{t("sol.heroTitle2")}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              {t("sol.heroSub")}
            </p>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {bundles.map((b) => {
              const Icon = b.icon;
              const bench = getBenchmark(b.vertical);
              return (
                <div key={b.slug} className="group flex flex-col rounded-3xl glass p-7 transition hover:-translate-y-1 hover:shadow-glow">
                  <div className="flex items-center justify-between">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric/25 to-indigo-500/15 text-cyan-electric">
                      <Icon className="h-5 w-5" strokeWidth={2.25} />
                    </div>
                    <span className="rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1 text-xs font-semibold text-cyan-electric tabular-nums">
                      {t(b.savings)}
                    </span>
                  </div>
                  <h2 className="mt-5 font-display text-xl font-semibold">{t(b.name)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t(b.tagline)}</p>
                  <ul className="mt-5 flex-1 space-y-2">
                    {b.includes.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-electric" />
                        <span>{t(it)}</span>
                      </li>
                    ))}
                  </ul>

                  {bench && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      {t("sol.peersSavePrefix")}~<span className="font-medium text-cyan-electric">${bench.avgMonthlySavings.toLocaleString()}{t("sol.perMonth")}</span>
                      {" · "}{t("sol.replyTimeLabel")} {t(bench.replyTimeBefore)} → {t(bench.replyTimeAfter)}
                    </p>
                  )}

                  <div className="mt-6 flex items-center gap-4">
                    <StartCTA industry={b.slug} size="sm">{t("sol.buildYours")}</StartCTA>
                    <Link
                      href={`/automations/${b.slug}`}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition group-hover:text-cyan-electric"
                    >
                      {t("sol.seePlaybook")} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Moat: build-your-own OS configurator */}
      <section className="border-y border-border/60 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">{t("sol.buildOsEyebrow")}</span>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("sol.mixMatch1")} <span className="gradient-text">{t("sol.mixMatch2")}</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {t("sol.mixMatchSub")}
            </p>
          </div>
          <div className="mt-12">
            <OsConfigurator />
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          <GuaranteeBanner />
        </div>
      </section>

      <section className="pb-16">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <h2 className="font-display text-3xl font-semibold">{t("sol.noIndustryTitle")}</h2>
            <p className="mt-3 text-muted-foreground">
              {t("sol.noIndustrySub")}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <StartCTA size="lg">
                {t("sol.buildAutomation")} <ArrowRight className="h-4 w-4" />
              </StartCTA>
              <Link href="/pricing">
                <Button variant="secondary" size="lg">
                  {t("sol.seePricing")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
