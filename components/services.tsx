"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { services } from "@/lib/data";
import { cn } from "@/lib/utils";

const toneColor: Record<string, string> = {
  zap: "bg-cyan-electric/15 text-cyan-electric border-cyan-electric/30",
  ai: "bg-indigo-400/15 text-indigo-300 border-indigo-400/30",
  crm: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  pay: "bg-fuchsia-400/15 text-fuchsia-300 border-fuchsia-400/30",
};

export function Services() {
  return (
    <section id="services" className="relative py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow="Services"
          title={
            <>
              Automation for <span className="gradient-text">every channel.</span>
            </>
          }
          sub="Pre-built playbooks we deploy in days, tuned to your stack and your voice."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {services.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.article
                key={s.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-3xl glass p-7 transition hover:-translate-y-1 hover:shadow-glow"
              >
                <div className="flex items-start justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric/25 to-indigo-500/15 text-cyan-electric">
                    <Icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:-rotate-45 group-hover:text-cyan-electric" />
                </div>

                <h3 className="mt-5 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>

                <FlowPreview flow={s.flow} />

                <div className="mt-4 flex flex-wrap gap-2">
                  {s.outcomes.map((o) => (
                    <span
                      key={o}
                      className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FlowPreview({
  flow,
}: {
  flow: { label: string; tone: string }[];
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-navy-950/40 p-3">
      <div className="flex items-center gap-2 overflow-x-auto">
        {flow.map((node, i) => (
          <div key={i} className="flex min-w-0 items-center gap-2">
            <motion.div
              initial={{ opacity: 0.4 }}
              whileInView={{ opacity: 1 }}
              transition={{
                duration: 0.4,
                delay: i * 0.3,
                repeat: Infinity,
                repeatType: "reverse",
                repeatDelay: 2,
              }}
              viewport={{ once: false }}
              className={cn(
                "shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium",
                toneColor[node.tone]
              )}
            >
              {node.label}
            </motion.div>
            {i < flow.length - 1 && (
              <svg width="22" height="10" viewBox="0 0 22 10" className="shrink-0">
                <line
                  x1="0"
                  y1="5"
                  x2="22"
                  y2="5"
                  stroke="rgba(0,229,255,0.45)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  className="animate-flow-dash"
                />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : ""
      )}
    >
      <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
        {eyebrow}
      </span>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {sub && (
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">{sub}</p>
      )}
    </div>
  );
}
