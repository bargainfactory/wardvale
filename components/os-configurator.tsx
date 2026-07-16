"use client";

import { useState } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bundles, addons } from "@/lib/solutions";
import { getBenchmark } from "@/lib/benchmarks";
import { formatCurrency } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useLocale } from "@/lib/locale-context";
import { useStartExperience } from "@/components/start-experience/provider";

/**
 * "Build Your OS" — pick a base vertical stack, toggle add-on agents, and see
 * live price, savings, ROI, and payback. Turns fixed bundles into a
 * configurable platform (the differentiator competitors don't productize).
 */
export function OsConfigurator() {
  const { t } = useLocale();
  const { open: openStart } = useStartExperience();
  const [baseIdx, setBaseIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const base = bundles[baseIdx];

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const chosen = addons.filter((a) => selected.includes(a.id));
  const price = base.basePrice + chosen.reduce((s, a) => s + a.price, 0);
  const savings = base.baseSavings + chosen.reduce((s, a) => s + a.savings, 0);
  const net = savings - price;
  const roi = savings / price;
  const payback = Math.max(1, Math.round((price / savings) * 30));
  const bench = getBenchmark(base.vertical);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Builder */}
        <div className="lg:col-span-3">
          <div className="rounded-3xl glass p-6">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
                1 · {t("sol.cfgStep1")}
              </span>
              <select
                value={baseIdx}
                onChange={(e) => setBaseIdx(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-border bg-card/60 px-4 py-3 text-sm focus:border-cyan-electric/50 focus:outline-none"
              >
                {bundles.map((b, i) => (
                  <option key={b.slug} value={i}>
                    {t(b.name)} — {t("sol.cfgFrom")} {formatCurrency(b.basePrice)}{t("sol.perMonth")}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {base.includes.map((it) => (
                <span
                  key={it}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-300"
                >
                  <Check className="h-3 w-3" /> {t(it)}
                </span>
              ))}
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
              2 · {t("sol.cfgStep2")}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {addons.map((a) => {
                const on = selected.includes(a.id);
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    aria-pressed={on}
                    className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                      on
                        ? "border-cyan-electric/50 bg-cyan-electric/10"
                        : "border-border bg-card/40 hover:border-cyan-electric/30"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                        on ? "bg-cyan-electric/20 text-cyan-electric" : "bg-white/5 text-muted-foreground"
                      }`}
                    >
                      {on ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {t(a.name)}
                        <span className="text-xs text-cyan-electric">+{formatCurrency(a.price)}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{t(a.desc)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live summary */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-3xl gradient-border glass-strong p-6">
            <p className="font-display text-lg font-semibold">{t(base.name)}</p>
            {chosen.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                + {chosen.map((a) => t(a.name)).join(", ")}
              </p>
            )}

            <div className="mt-5 flex items-baseline gap-1">
              <span className="font-display text-4xl font-semibold tabular-nums">{formatCurrency(price)}</span>
              <span className="text-sm text-muted-foreground">{t("sol.cfgPerMo")}</span>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <Row label={t("sol.rowSavings")} value={`${formatCurrency(savings)}`} accent />
              <Row label={t("sol.rowNetGain")} value={`${net >= 0 ? "+" : ""}${formatCurrency(net)}`} />
              <Row label={t("sol.rowReturn")} value={`${roi.toFixed(1)}×`} />
              <Row label={t("sol.rowPayback")} value={`~${payback} ${t("sol.days")}`} />
            </div>

            {bench && (
              <p className="mt-4 rounded-xl border border-indigo-400/25 bg-indigo-400/10 p-3 text-xs text-muted-foreground">
                {t("sol.cfgPeersPrefix")}{" "}
                <span className="font-medium text-cyan-electric">
                  {formatCurrency(bench.avgMonthlySavings)}{t("sol.perMonth")}
                </span>{" "}
                {t("sol.cfgPeersMid")} {t(bench.replyTimeBefore)} {t("sol.cfgPeersTo")} {t(bench.replyTimeAfter)}.
              </p>
            )}

            <Button
              size="lg"
              className="mt-5 w-full"
              onClick={() => {
                track("configurator_build", { os: base.name, addons: selected, price, savings });
                openStart(base.slug);
              }}
            >
              {t("sol.buildThisStack")} <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-electric" /> {t("sol.cfgGuarantee")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-display font-semibold tabular-nums ${accent ? "gradient-text" : ""}`}>{value}</span>
    </div>
  );
}
