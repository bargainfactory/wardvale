"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";

type Impact = { realized: number; businesses: number; actions: number };

/**
 * Landing proof bar wired to REAL aggregates — total value the agents have made
 * for clients. Renders only once there's genuine realized value, so the site
 * never advertises $0 before the data exists.
 */
export function ProvenImpact() {
  const { t } = useLocale();
  const [data, setData] = useState<Impact | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/public/impact")
      .then((r) => r.json())
      .then((d: Impact) => {
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data || data.realized <= 0) return null;

  const stats = [
    { label: t("cmp.impact.madeForClients"), value: `$${data.realized.toLocaleString()}` },
    { label: t("cmp.impact.businessesAutomated"), value: data.businesses.toLocaleString() },
    { label: t("cmp.impact.actionsTaken"), value: data.actions.toLocaleString() },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="grid grid-cols-3 gap-4 rounded-2xl border border-border bg-card/40 p-6 text-center backdrop-blur">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="font-display text-2xl font-semibold tabular-nums text-cyan-electric sm:text-3xl">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("cmp.impact.footnote")}</p>
    </div>
  );
}
