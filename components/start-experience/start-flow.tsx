"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Mic, Sparkles } from "lucide-react";
import { bundles } from "@/lib/solutions";
import { useLocale } from "@/lib/locale-context";
import { WorkflowBuilder } from "@/components/workflow-builder";

const CALENDLY = process.env.NEXT_PUBLIC_CALENDLY_URL ?? "https://calendly.com/wardvale/discovery";

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
  const chosen = bundles.find((b) => b.slug === slug);

  if (chosen) {
    return (
      <div className="max-h-[85vh] overflow-y-auto p-6 md:p-8">
        <div className="mb-4 flex items-center justify-between gap-3">
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
        <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5" /> {t("start.typeOrSpeak")}
        </p>
        {/* Industry passed as the benchmark vertical; builder auto-begins. */}
        <WorkflowBuilder industry={chosen.vertical} embedded />
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

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
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
