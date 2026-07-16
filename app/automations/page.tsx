import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { seoPages } from "@/lib/seo-pages";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    title: t("msc.automationsMetaTitle"),
    description: t("msc.automationsMetaDescription"),
    alternates: { canonical: locale === "en" ? "/automations" : `/${locale}/automations` },
  };
}

export default async function AutomationsIndexPage() {
  const { t } = await getT();
  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative overflow-hidden pb-16">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark" />
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
              {t("msc.automationsEyebrow")}
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.1]">
              {t("msc.automationsH1a")}{" "}
              <span className="gradient-text">{t("msc.automationsH1b")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {t("msc.automationsIntro")}
            </p>
          </div>
        </div>
      </section>

      {/* Playbook grid */}
      <section className="pb-16">
        <div className="container">
          <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {seoPages.map((page) => (
              <Link
                key={page.slug}
                href={`/automations/${page.slug}`}
                className="group glass flex flex-col rounded-3xl border border-border p-7 transition-all hover:-translate-y-1 hover:border-cyan-electric/50 hover:shadow-glow"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
                    {t(page.vertical)}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-cyan-electric" />
                </div>
                <h2 className="mt-3 font-display text-xl font-semibold leading-snug">
                  {t(page.workflow)}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {t(page.solution).split(". ")[0]}.
                </p>
                <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {t("msc.automationsEstSavings")}
                    </p>
                    <p className="font-display text-lg font-semibold tabular-nums gradient-text">
                      {t(page.savings)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-cyan-electric">
                    {t("msc.automationsReadPlaybook")} →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <h2 className="font-display text-3xl font-semibold">
              {t("msc.automationsCtaTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("msc.automationsCtaBody")}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/build">
                <Button size="lg">
                  {t("msc.buildAutomationFree")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="secondary" size="lg">
                  {t("msc.seePricing")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
