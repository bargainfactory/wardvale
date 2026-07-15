import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Sparkles, Zap } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { ImpactStats } from "@/components/impact-stats";
import { benchmarks, benchmarkLabelKey } from "@/lib/benchmarks";
import { getServiceClient } from "@/lib/supabase-server";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("imp.metaTitle"),
    description: t("imp.metaDescription"),
    alternates: { canonical: "/impact" },
  };
}

// Cache-free so the numbers reflect the latest runs on each request.
export const dynamic = "force-dynamic";

type RunRow = {
  minutes_saved: number | null;
  dollars_saved: number | null;
  status: string | null;
};

type ImpactTotals = {
  runs: number;
  hoursSaved: number;
  dollarsSaved: number;
  successRate: number;
  live: boolean;
};

// Representative fallback used until real client runs are connected.
const ILLUSTRATIVE: ImpactTotals = {
  runs: 128_400,
  hoursSaved: 41_250,
  dollarsSaved: 2_940_000,
  successRate: 99,
  live: false,
};

async function getImpactTotals(): Promise<ImpactTotals> {
  try {
    const supabase = getServiceClient();
    if (!supabase) return ILLUSTRATIVE;

    const { data, error } = await supabase
      .from("runs")
      .select("minutes_saved, dollars_saved, status")
      .limit(5000);

    if (error || !data || data.length === 0) return ILLUSTRATIVE;

    const rows = data as RunRow[];
    let minutes = 0;
    let dollars = 0;
    let successes = 0;

    for (const row of rows) {
      minutes += row.minutes_saved ?? 0;
      dollars += row.dollars_saved ?? 0;
      if (row.status === "success") successes += 1;
    }

    return {
      runs: rows.length,
      hoursSaved: Math.round(minutes / 60),
      dollarsSaved: Math.round(dollars),
      successRate: Math.round((successes / rows.length) * 100),
      live: true,
    };
  } catch {
    return ILLUSTRATIVE;
  }
}

export default async function ImpactPage() {
  const { t } = await getT();
  const totals = await getImpactTotals();

  const stats = [
    { label: t("imp.statRunsLabel"), value: totals.runs },
    { label: t("imp.statHoursLabel"), value: totals.hoursSaved },
    { label: t("imp.statSavedLabel"), value: totals.dollarsSaved, prefix: "$" },
    { label: t("imp.statSuccessLabel"), value: totals.successRate, suffix: "%" },
  ];

  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative overflow-hidden pb-16">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark" />
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-4 py-1.5 text-xs font-medium text-cyan-electric">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-cyan-electric" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-electric" />
              </span>
              {t("imp.heroEyebrow")}
            </span>
            <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.1]">
              {t("imp.heroTitleLead")}{" "}
              <span className="gradient-text">{t("imp.heroTitleHighlight")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {t("imp.heroSubtitle")}
            </p>
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section className="pb-6">
        <div className="container">
          <div className="mx-auto max-w-5xl">
            <ImpactStats stats={stats} />
            {!totals.live && (
              <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-cyan-electric" />
                {t("imp.illustrativeNote")}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Benchmarks library */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              {t("imp.benchmarksTitleLead")}{" "}
              <span className="gradient-text">{t("imp.benchmarksTitleHighlight")}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              {t("imp.benchmarksSubtitle")}
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {benchmarks.map((b) => (
              <div
                key={b.vertical}
                className="gradient-border glass flex flex-col rounded-3xl p-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-semibold">{t(benchmarkLabelKey(b.vertical))}</h3>
                  <span className="rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1 text-sm font-semibold text-cyan-electric tabular-nums">
                    ${b.avgMonthlySavings.toLocaleString()}/mo
                  </span>
                </div>

                <p className="mt-4 text-sm text-muted-foreground">
                  {t(b.topAutomation)}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border bg-card/40 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 text-cyan-electric" />
                      {t("imp.hoursSavedPerMonth")}
                    </div>
                    <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
                      {b.avgHoursSaved}h
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/40 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-cyan-electric" />
                      {t("imp.replyTime")}
                    </div>
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      <span className="text-muted-foreground line-through">
                        {t(b.replyTimeBefore)}
                      </span>
                      <ArrowRight className="mx-1 inline h-3 w-3 text-cyan-electric" />
                      <span className="text-cyan-electric">{t(b.replyTimeAfter)}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <h2 className="font-display text-3xl font-semibold">
              {t("imp.ctaTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("imp.ctaSubtitle")}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href="/build">
                <Button size="lg">
                  {t("imp.ctaBuild")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg">
                  {t("imp.ctaPricing")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
