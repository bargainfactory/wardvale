import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Sparkles, TrendingDown } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { seoPages } from "@/lib/seo-pages";

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

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/automations/${slug}` },
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

  const { head, tail } = splitHeadline(page.h1);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.workflow,
    serviceType: `${page.vertical} automation`,
    description: page.metaDescription,
    provider: {
      "@type": "Organization",
      name: "FlowForge AI",
      url: siteUrl,
    },
    areaServed: "US",
    url: `${siteUrl}/automations/${page.slug}`,
    offers: {
      "@type": "Offer",
      description: `Estimated savings ${page.savings}`,
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
              {page.vertical} automation
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.1]">
              {head && <>{head} </>}
              <span className="gradient-text">{tail}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {page.metaDescription}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/build">
                <Button size="lg">
                  Build this automation free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg">
                  See pricing
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
                The problem
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {page.problem}
              </p>
            </div>
            <div className="gradient-border glass-strong rounded-3xl p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
                How FlowForge fixes it
              </p>
              <p className="mt-4 text-base leading-relaxed text-foreground/90">
                {page.solution}
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
                How the automation runs
              </h2>
              <p className="mt-2 text-muted-foreground">
                Four connected steps, running fully hands-off.
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
                        {step.tool}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-snug">
                      {step.label}
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
                  Estimated impact
                </span>
              </div>
              <p className="mt-4 font-display text-5xl font-semibold tabular-nums gradient-text">
                {page.savings}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                saved in labor and recovered revenue, typical for a small {page.vertical.toLowerCase()} business.
              </p>
            </div>
            <div className="glass rounded-3xl p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Tools we connect
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {page.tools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-3.5 py-1.5 text-sm text-foreground"
                  >
                    <Check className="h-3.5 w-3.5 text-cyan-electric" />
                    {tool}
                  </span>
                ))}
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                Already using something else? FlowForge integrates with the tools you
                run today, no rip-and-replace required.
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
              <Sparkles className="h-3 w-3" /> Free to build
            </span>
            <h2 className="mt-5 font-display text-3xl font-semibold">
              Build your {page.workflow.toLowerCase()} in minutes
            </h2>
            <p className="mt-3 text-muted-foreground">
              Map it out in our interactive builder and see exactly what FlowForge
              would run for you. No credit card, no commitment.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/build">
                <Button size="lg">
                  Build this automation free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="secondary" size="lg">
                  See pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
