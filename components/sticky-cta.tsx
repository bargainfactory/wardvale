"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";

export function StickyCTA() {
  const { t } = useLocale();

  const questions = [
    {
      id: "biz",
      label: t("sticky.q1"),
      options: ["Restaurant", "E-commerce", "Consulting", "Local services", "Other"],
    },
    {
      id: "size",
      label: t("sticky.q2"),
      options: ["Solo", "2–5", "6–15", "16–50", "50+"],
    },
    {
      id: "pain",
      label: t("sticky.q3"),
      options: [
        "Email / inbox",
        "Lead follow-up",
        "Onboarding clients",
        "Scheduling & reminders",
        "Reporting & data entry",
      ],
    },
    {
      id: "budget",
      label: t("sticky.q4"),
      options: ["$500", "$1,000", "$1,500–2k", "$3,000+", "Not sure yet"],
    },
  ];
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function pick(value: string) {
    const q = questions[step];
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      setDone(true);
      fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
    }
  }

  function reset() {
    setStep(0);
    setAnswers({});
    setDone(false);
    setOpen(false);
  }

  return (
    <>
      <AnimatePresence>
        {visible && !open && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              size="lg"
              className="gap-2 shadow-glow-lg"
              onClick={() => setOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              {t("sticky.audit")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-6 right-6 z-50 w-[340px] overflow-hidden rounded-3xl border border-white/10 bg-navy-900/95 shadow-glow-lg backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-cyan-electric" />
                {t("sticky.title")}
              </div>
              <button
                onClick={reset}
                className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-5">
              <AnimatePresence mode="wait">
                {!done ? (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("sticky.q")} {step + 1} {t("sticky.of")} {questions.length}</span>
                      <div className="flex gap-1">
                        {questions.map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 w-6 rounded-full ${
                              i <= step ? "bg-cyan-electric" : "bg-white/10"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mb-4 text-sm font-medium">{questions[step].label}</p>
                    <div className="space-y-2">
                      {questions[step].options.map((o) => (
                        <button
                          key={o}
                          onClick={() => pick(o)}
                          className="flex w-full items-center justify-between rounded-xl border border-border bg-white/[0.03] px-4 py-3 text-left text-sm transition hover:border-cyan-electric/40 hover:bg-cyan-electric/5"
                        >
                          {o}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                  >
                    <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-cyan-electric/15">
                      <Sparkles className="h-5 w-5 text-cyan-electric" />
                    </div>
                    <p className="font-display font-semibold">{t("sticky.done")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("sticky.doneSub")}
                    </p>
                    <Button
                      className="mt-5 w-full"
                      onClick={() =>
                        window.location.assign("/pricing#quote")
                      }
                    >
                      {t("sticky.fullQuote")}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
