"use client";

import { ShieldCheck } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

/** Full-width guarantee banner for pricing / landing pages. */
export function GuaranteeBanner() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col items-center gap-4 rounded-3xl gradient-border glass-strong p-8 text-center sm:flex-row sm:text-left">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric/25 to-indigo-500/15 text-cyan-electric">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div>
          <h3 className="font-display text-xl font-semibold">{t("cmp.guarantee.headline")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("cmp.guarantee.sub")}</p>
        </div>
      </div>
    </div>
  );
}

/** Compact inline guarantee pill for blueprints / tight spaces. */
export function GuaranteePill() {
  const { t } = useLocale();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1 text-xs font-medium text-cyan-electric">
      <ShieldCheck className="h-3.5 w-3.5" />
      {t("cmp.guarantee.pill")}
    </span>
  );
}
