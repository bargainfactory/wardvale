"use client";

import { motion } from "framer-motion";
import { steps } from "@/lib/data";
import { SectionHeader } from "@/components/services";
import { useLocale } from "@/lib/locale-context";

export function HowItWorks() {
  const { t } = useLocale();
  return (
    <section id="process" className="relative py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow="How it works"
          title={
            <>
              One perfect workflow. <span className="gradient-text">Five steps.</span>
            </>
          }
          sub="Discovery to scale in 14 days. Every client, every vertical, every time."
        />

        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-electric/40 to-transparent md:block" />

          <ol className="space-y-4 md:space-y-10">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isRight = i % 2 === 1;
              return (
                <motion.li
                  key={s.n}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  className={`relative grid items-center gap-6 md:grid-cols-2 ${
                    isRight ? "md:[&>*:first-child]:col-start-2" : ""
                  }`}
                >
                  <div
                    className={`gradient-border glass rounded-3xl p-7 ${
                      isRight ? "md:text-right" : ""
                    }`}
                  >
                    <div
                      className={`flex items-center gap-3 ${
                        isRight ? "md:justify-end" : ""
                      }`}
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric to-indigo-400 font-display text-lg font-semibold text-navy-900 shadow-glow">
                        {s.n}
                      </span>
                      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5">
                        <Icon className="h-5 w-5 text-cyan-electric" />
                      </div>
                    </div>
                    <h3 className="mt-5 font-display text-xl font-semibold">
                      {t(s.title)}
                    </h3>
                    <p className="mt-2 text-muted-foreground">{t(s.desc)}</p>
                  </div>

                  <div
                    className={`hidden text-muted-foreground md:block ${
                      isRight ? "md:text-left" : "md:text-right"
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-widest">
                      Typical turnaround
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
                      {["30 min", "48 h", "7 days", "Day 14", "Ongoing"][i]}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
