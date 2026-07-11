import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { seoPages } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Automation Playbooks by Industry",
  description:
    "Proven AI automation playbooks for restaurants, ecommerce, home services, law firms, and more. Pick your industry, see the workflow, and build it free with FlowForge.",
  alternates: { canonical: "/automations" },
};

export default function AutomationsIndexPage() {
  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative overflow-hidden pb-16">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark" />
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
              Playbook library
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.1]">
              Automation playbooks, <span className="gradient-text">by industry</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Battle-tested AI workflows for real small businesses. Find the one that
              fits your shop, see exactly how it runs, and build it free in minutes.
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
                    {page.vertical}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-cyan-electric" />
                </div>
                <h2 className="mt-3 font-display text-xl font-semibold leading-snug">
                  {page.workflow}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {page.solution.split(". ")[0]}.
                </p>
                <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Est. savings
                    </p>
                    <p className="font-display text-lg font-semibold tabular-nums gradient-text">
                      {page.savings}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-cyan-electric">
                    Read the playbook →
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
              Don&apos;t see your exact workflow?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Our interactive builder maps any automation for your business, in your
              stack. Describe what you want and watch it come together, free.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/build">
                <Button size="lg">
                  Build your automation free
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
