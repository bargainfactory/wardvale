"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Star, Quote } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { testimonials, trustBadges } from "@/lib/data";
import { SectionHeader } from "@/components/services";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";

export function Testimonials() {
  const { t } = useLocale();
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const timer = useRef<ReturnType<typeof setInterval>>(null);

  const next = useCallback(() => {
    setDir(1);
    setIdx((i) => (i + 1) % testimonials.length);
  }, []);

  const prev = useCallback(() => {
    setDir(-1);
    setIdx((i) => (i - 1 + testimonials.length) % testimonials.length);
  }, []);

  useEffect(() => {
    timer.current = setInterval(next, 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [next]);

  const item = testimonials[idx];

  return (
    <section className="relative py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow="Testimonials"
          title={
            <>
              Clients who <span className="gradient-text">stopped doing it manually.</span>
            </>
          }
        />

        <div className="relative mx-auto mt-14 max-w-3xl">
          <div className="gradient-border glass-strong relative overflow-hidden rounded-3xl p-8 md:p-12">
            <Quote className="absolute right-8 top-8 h-12 w-12 text-cyan-electric/10" />

            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={idx}
                custom={dir}
                initial={{ opacity: 0, x: dir * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -40 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>

                <blockquote className="mt-5 font-display text-xl font-medium leading-relaxed sm:text-2xl">
                  &ldquo;{t(item.quote)}&rdquo;
                </blockquote>

                <div className="mt-6 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(item.role)}, {item.company}
                    </p>
                  </div>
                  <span className="rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1.5 text-sm font-semibold text-cyan-electric tabular-nums">
                    {item.metric}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={prev}
              aria-label="Previous"
              className="grid h-10 w-10 place-items-center rounded-full border border-border transition hover:border-cyan-electric/40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setDir(i > idx ? 1 : -1); setIdx(i); }}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === idx ? "w-8 bg-cyan-electric" : "w-2 bg-white/20"
                  )}
                />
              ))}
            </div>
            <button
              onClick={next}
              aria-label="Next"
              className="grid h-10 w-10 place-items-center rounded-full border border-border transition hover:border-cyan-electric/40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mx-auto mt-16 flex max-w-4xl flex-wrap items-center justify-center gap-3">
          {trustBadges.map((b) => (
            <span
              key={b}
              className="rounded-full border border-border bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur"
            >
              {t(b)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
