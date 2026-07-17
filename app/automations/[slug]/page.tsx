import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Sparkles, TrendingDown } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { seoPages } from "@/lib/seo-pages";
import { StartCTA } from "@/components/start-experience/start-cta";
import { getT } from "@/lib/i18n-server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://flowforge.ai";

export async function generateStaticParams() {
  return seoPages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = seoPages.find((p) => p.slug === slug);
  if (!page) notFound();

  const { t, locale } = await getT();
  return {
    title: t(page.metaTitle),
    description: t(page.metaDescription),
    alternates: { canonical: locale === "en" ? `/automations/${slug}` : `/${locale}/automations/${slug}` },
  };
}

/** Wrap the last two words of the H1 in the gradient accent. */
function splitHeadline(h1: string): { head: string; tail: string } {
  const words = h1.split(" ");
  if (words.length <= 2) return { head: "", tail: h1 };
  const tail = words.slice(-2).join(" ");
  const head = words.slice(0, -2).join(" ");
  return { head, tail };
}

export default async function AutomationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = seoPages.find((p) => p.slug === slug);
  if (!page) notFound();

  const { t } = await getT();
  const { head, tail } = splitHeadline(t(page.h1));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: t(page.workflow),
    serviceType: `${t(page.vertical)} automation`,
    description: t(page.metaDescription),
    provider: {
      "@type": "Organization",
      name: "FlowForge AI",
      url: siteUrl,
    },
    areaServed: "US",
    url: `${siteUrl}/automations/${page.slug}`,
    offers: {
      "@type": "Offer",
      description: `Estimated savings ${t(page.savings)}`,
      priceCurrency: "USD",
    },
  };

  return (
    <PageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden pb-16">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark" />
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
              {t(page.vertical)} {t("msc.slugAutomationLabel")}
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.1]">
              {head && <>{head} </>}
              <span className="gradient-text">{tail}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {t(page.metaDescription)}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <StartCTA industry={slug} size="lg">
                {t("msc.slugBuildFree")}
                <ArrowRight className="h-4 w-4" />
              </StartCTA>
              <Link href="/pricing">
                <Button variant="outline" size="lg">
                  {t("msc.seePricing")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem + Solution */}
      <section className="pb-16">
        <div className="container">
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
            <div className="glass rounded-3xl p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("msc.slugTheProblem")}
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {t(page.problem)}
              </p>
            </div>
            <div className="gradient-border glass-strong rounded-3xl p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
                {t("msc.slugHowFixes")}
              </p>
              <p className="mt-4 text-base leading-relaxed text-foreground/90">
                {t(page.solution)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Flow of steps */}
      <section className="pb-16">
        <div className="container">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className="font-display text-3xl font-semibold">
                {t("msc.slugHowRuns")}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {t("msc.slugHowRunsSub")}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
              {page.steps.map((step, i) => (
                <div key={i} className="flex flex-1 items-center gap-4 lg:flex-col">
                  <div className="glass flex w-full flex-1 flex-col rounded-2xl border border-border p-6">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-electric/15 text-xs font-semibold text-cyan-electric">
                        {i + 1}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-electric">
                        {t(step.tool)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-snug">
                      {t(step.label)}
                    </p>
                  </div>
                  {i < page.steps.length - 1 && (
                    <ArrowRight className="h-5 w-5 shrink-0 rotate-90 text-cyan-electric/60 lg:rotate-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Savings stat + tools */}
      <section className="pb-16">
        <div className="container">
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-[1fr_1.4fr]">
            <div className="gradient-border glass-strong flex flex-col justify-center rounded-3xl p-8">
              <div className="flex items-center gap-2 text-cyan-electric">
                <TrendingDown className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                  {t("msc.slugEstImpact")}
                </span>
              </div>
              <p className="mt-4 font-display text-5xl font-semibold tabular-nums gradient-text">
                {t(page.savings)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("msc.slugSavingsPre")}{t(page.vertical).toLowerCase()}{t("msc.slugSavingsPost")}
              </p>
            </div>
            <div className="glass rounded-3xl p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("msc.slugToolsConnect")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {page.tools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-3.5 py-1.5 text-sm text-foreground"
                  >
                    <Check className="h-3.5 w-3.5 text-cyan-electric" />
                    {t(tool)}
                  </span>
                ))}
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                {t("msc.slugToolsBody")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-electric/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-electric">
              <Sparkles className="h-3 w-3" /> {t("msc.slugFreeToBuild")}
            </span>
            <h2 className="mt-5 font-display text-3xl font-semibold">
              {t("msc.slugBuildPre")}{t(page.workflow).toLowerCase()}{t("msc.slugBuildPost")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("msc.slugCtaBody")}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <StartCTA industry={slug} size="lg">
                {t("msc.slugBuildFree")}
                <ArrowRight className="h-4 w-4" />
              </StartCTA>
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
