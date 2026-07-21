"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Check, Mic, Sparkles } from "lucide-react";
import { bundles } from "@/lib/solutions";
import { getPack, agentName } from "@/lib/agents-catalog";
import { useLocale } from "@/lib/locale-context";
import { WorkflowBuilder } from "@/components/workflow-builder";

const CALENDLY = process.env.NEXT_PUBLIC_CALENDLY_URL ?? "https://calendly.com/wardvale/discovery";

// The interview roadmap the side panel previews (generic across verticals) —
// so a customer can anticipate what's coming instead of typing into a void.
const ROADMAP = ["start.rm1", "start.rm2", "start.rm3", "start.rm4", "start.rm5", "start.rm6"];

/**
 * The unified conversion experience: choose an industry, then a self-paced
 * questionnaire (type OR speak, powered by WorkflowBuilder) that tailors an
 * automation and ends at a pre-filled strategy-call booking. Rendered both
 * inside the site-wide modal (StartExperienceProvider) and inline on /build
 * and the home #builder section. `initialIndustry` is a bundle slug.
 */
export function StartFlow({ initialIndustry = "" }: { initialIndustry?: string }) {
  const { t } = useLocale();
  const [slug, setSlug] = useState(initialIndustry);
  const [step, setStep] = useState<{ progress: number; answered: number; done: boolean }>({ progress: 0, answered: 0, done: false });
  const chosen = bundles.find((b) => b.slug === slug);

  if (chosen) {
    const pack = chosen.packId ? getPack(chosen.packId) : undefined;
    const current = step.done ? ROADMAP.length : Math.min(ROADMAP.length - 1, step.answered);

    return (
      <div className="max-h-[85vh] overflow-y-auto p-6 md:p-8">
        <div className="mb-4 flex items-center justify-between gap-3 pr-10">
          <button
            type="button"
            onClick={() => setSlug("")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t("start.changeIndustry")}
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-2.5 py-1 text-xs font-medium text-cyan-electric">
            {t(chosen.name)}
          </span>
        </div>

        {/* ── Roadmap stepper: full-width horizontal strip across the top ── */}
        <div className="mb-6 rounded-2xl border border-border bg-card/40 px-4 py-4 md:px-6">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{t("start.roadmapTitle")}</p>
          <ol className="grid grid-cols-3 gap-y-4 sm:flex sm:items-start sm:gap-0">
            {ROADMAP.map((key, i) => {
              const done = i < current;
              const active = i === current;
              return (
                <li key={key} className="flex flex-col items-center text-center sm:flex-1">
                  <div className="flex w-full items-center">
                    {/* connector left */}
                    <span className={`hidden h-px flex-1 sm:block ${i === 0 ? "opacity-0" : done || active ? "bg-cyan-electric/50" : "bg-border"}`} />
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-medium transition sm:mx-1 ${
                        done
                          ? "border-cyan-electric/40 bg-cyan-electric/15 text-cyan-electric"
                          : active
                            ? "border-cyan-electric bg-cyan-electric text-background"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    {/* connector right */}
                    <span className={`hidden h-px flex-1 sm:block ${i === ROADMAP.length - 1 ? "opacity-0" : done ? "bg-cyan-electric/50" : "bg-border"}`} />
                  </div>
                  <span className={`mt-2 px-1 text-xs leading-tight sm:text-[13px] ${active ? "font-medium text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                    {t(key)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* ── Input → outcome: your answers on the left build the OS on the right ── */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <div className="flex min-h-[440px] flex-col">
            <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-cyan-electric">{t("start.inputKicker")}</p>
            <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mic className="h-3.5 w-3.5" /> {t("start.typeOrSpeak")}
            </p>
            {/* Industry passed as the benchmark vertical; builder auto-begins. */}
            <WorkflowBuilder industry={chosen.vertical} embedded onStep={setStep} />
          </div>

          {pack && (
            <aside className="lg:sticky lg:top-2 lg:self-start">
              <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{t("start.outcomeKicker")}</p>
              <div className="rounded-2xl border border-cyan-electric/20 bg-cyan-electric/[0.04] p-5">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-cyan-electric">
                  <Sparkles className="h-3.5 w-3.5" /> {t("start.preinstalledTitle")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t("start.preinstalledHint")}</p>
                <ul className="mt-4 space-y-2">
                  {pack.agents.map((key) => (
                    <li key={key} className="flex items-center gap-2 text-[15px]">
                      <Check className="h-3.5 w-3.5 shrink-0 text-cyan-electric" />
                      {agentName(key)}
                    </li>
                  ))}
                </ul>
                {/* The payoff line — modeled, and labeled as such. */}
                <div className="mt-5 border-t border-cyan-electric/15 pt-4">
                  <p className="text-xs text-muted-foreground">{t("start.outcomeModeled")}</p>
                  <p className="mt-0.5 font-display text-2xl font-semibold gradient-text">{t(chosen.savings)}</p>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[85vh] overflow-y-auto p-6 md:p-8">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1 text-xs font-medium text-cyan-electric">
          <Sparkles className="h-3 w-3" /> {t("start.eyebrow")}
        </span>
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">{t("start.pickIndustryTitle")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("start.pickIndustrySub")}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {bundles.map((b, i) => {
          const Icon = b.icon;
          return (
            <motion.button
              key={b.slug}
              type="button"
              onClick={() => setSlug(b.slug)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.2) }}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-card/40 p-3.5 text-left transition hover:border-cyan-electric/50 hover:bg-cyan-electric/5"
            >
              <Icon className="h-5 w-5 text-cyan-electric" />
              <span className="text-sm font-medium leading-tight">{t(b.name)}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <a href="/connect" className="inline-flex items-center gap-1.5 font-medium text-cyan-electric underline underline-offset-2 transition hover:text-foreground">
          <Sparkles className="h-3.5 w-3.5" /> {t("start.tryOnData")}
        </a>
        <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 underline underline-offset-2 transition hover:text-foreground">
          <Calendar className="h-3.5 w-3.5" /> {t("start.justBook")}
        </a>
      </div>
    </div>
  );
}
