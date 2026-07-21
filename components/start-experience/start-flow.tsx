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

        {/* Dashboard: the interview on the left, a live preview of what's coming
            and what's being tailored on the right. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mic className="h-3.5 w-3.5" /> {t("start.typeOrSpeak")}
            </p>
            {/* Industry passed as the benchmark vertical; builder auto-begins. */}
            <WorkflowBuilder industry={chosen.vertical} embedded onStep={setStep} />
          </div>

          <aside className="space-y-5 lg:sticky lg:top-2 lg:self-start">
            {/* Roadmap — anticipate the coming questions */}
            <div className="rounded-2xl border border-border bg-card/40 p-4">
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{t("start.roadmapTitle")}</p>
              <ol className="space-y-2.5">
                {ROADMAP.map((key, i) => {
                  const done = i < current;
                  const active = i === current;
                  return (
                    <li key={key} className={`flex items-center gap-2.5 text-[15px] transition ${active ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${done ? "border-cyan-electric/40 bg-cyan-electric/15 text-cyan-electric" : active ? "border-cyan-electric bg-cyan-electric text-background" : "border-border"}`}>
                        {done ? <Check className="h-3 w-3" /> : i + 1}
                      </span>
                      {t(key)}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Pre-installed agents — what the answers are tailoring */}
            {pack && (
              <div className="rounded-2xl border border-cyan-electric/20 bg-cyan-electric/[0.04] p-4">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-cyan-electric">
                  <Sparkles className="h-3.5 w-3.5" /> {t("start.preinstalledTitle")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t("start.preinstalledHint")}</p>
                <ul className="mt-3 space-y-1.5">
                  {pack.agents.map((key) => (
                    <li key={key} className="flex items-center gap-2 text-[15px]">
                      <Check className="h-3.5 w-3.5 shrink-0 text-cyan-electric" />
                      {agentName(key)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
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
