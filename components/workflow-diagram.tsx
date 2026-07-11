"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Calendar,
  Check,
  CreditCard,
  Globe,
  Instagram,
  LineChart,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Play,
  RotateCcw,
  ShoppingBag,
  Table,
  Users,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Step = { label: string; tool: string };

// Map a tool/label string to the closest brand-ish icon. Order = specificity.
const ICON_MAP: [RegExp, LucideIcon][] = [
  [/hubspot|crm|contact|lead|customer/i, Users],
  [/gmail|email|inbox|mail|outlook/i, Mail],
  [/shopify|store|cart|ecom|order|product/i, ShoppingBag],
  [/sheet|airtable|notion|excel|table|database|record/i, Table],
  [/instagram|dm|social|facebook|tiktok/i, Instagram],
  [/slack|message|chat|sms|text|twilio/i, MessageSquare],
  [/calendly|calendar|book|appointment|schedul/i, Calendar],
  [/stripe|payment|invoice|billing|charge/i, CreditCard],
  [/phone|call|voice|missed/i, Phone],
  [/gpt|agent|\bai\b|model|assistant|decide|read|draft|classif/i, Bot],
  [/portal|log|report|dashboard|analytics|kpi/i, LineChart],
  [/webhook|zapier|make|trigger|api|form|webform/i, Webhook],
  [/site|web|page|url/i, Globe],
];

function iconFor(s: string): LucideIcon {
  for (const [re, Icon] of ICON_MAP) if (re.test(s)) return Icon;
  return Zap;
}

export function WorkflowDiagram({
  trigger,
  steps,
  savedPerRun,
}: {
  trigger: string;
  steps: Step[];
  savedPerRun?: number;
}) {
  // Trigger becomes the entry node; drop a redundant leading "trigger" step.
  const flowSteps = steps.filter((s, i) => !(i === 0 && /trigger|detected/i.test(s.label)));
  const nodes: Step[] = [{ label: trigger, tool: "Trigger" }, ...flowSteps];

  const [active, setActive] = useState(-1);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const run = useCallback(() => {
    clearTimers();
    setPhase("running");
    setActive(0);
    const STEP_MS = 760;
    nodes.forEach((_, i) => {
      timers.current.push(setTimeout(() => setActive(i), i * STEP_MS));
    });
    timers.current.push(
      setTimeout(() => {
        setActive(nodes.length);
        setPhase("done");
      }, nodes.length * STEP_MS)
    );
  }, [nodes.length, clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setActive(-1);
    setPhase("idle");
  }, [clearTimers]);

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${
                phase === "running" ? "animate-pulse-ring bg-cyan-electric" : "bg-emerald-400"
              }`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                phase === "running" ? "bg-cyan-electric" : "bg-emerald-400"
              }`}
            />
          </span>
          {phase === "running" ? "Running…" : phase === "done" ? "Run complete" : "Live flow preview"}
        </div>
        <button
          onClick={phase === "idle" ? run : reset}
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-electric/30 bg-cyan-electric/10 px-3 py-1 text-xs font-semibold text-cyan-electric transition hover:bg-cyan-electric/20"
        >
          {phase === "idle" ? <Play className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
          {phase === "idle" ? "Watch it run" : "Replay"}
        </button>
      </div>

      <div className="flex flex-wrap items-stretch gap-y-3">
        {nodes.map((node, i) => {
          const isDone = phase !== "idle" && active > i;
          const isProcessing = phase === "running" && active === i;
          const Icon = iconFor(`${node.label} ${node.tool}`);
          return (
            <div key={i} className="flex items-stretch">
              {i > 0 && <Connector filled={phase !== "idle" && active >= i} />}
              <motion.div
                animate={{
                  scale: isProcessing ? 1.04 : 1,
                  opacity: phase === "idle" || isDone || isProcessing ? 1 : 0.55,
                }}
                transition={{ duration: 0.25 }}
                className={`relative w-36 rounded-xl border p-3 ${
                  isProcessing
                    ? "border-cyan-electric/60 bg-cyan-electric/10 shadow-glow"
                    : isDone
                    ? "border-emerald-400/40 bg-emerald-400/5"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-lg ${
                      isProcessing
                        ? "bg-cyan-electric/20 text-cyan-electric"
                        : isDone
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-white/10 text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {isProcessing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-electric" />
                  ) : isDone ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {i === 0 ? "In" : `#${i}`}
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-medium leading-tight">{node.label}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{node.tool}</p>
              </motion.div>
            </div>
          );
        })}
      </div>

      {phase === "done" && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3 text-sm"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          <span className="text-muted-foreground">
            Completed in <span className="font-medium text-foreground">1.8s</span>
            {savedPerRun ? (
              <>
                {" · "}saved{" "}
                <span className="font-medium text-cyan-electric">~{savedPerRun} min</span> of manual work
              </>
            ) : null}
          </span>
        </motion.div>
      )}
    </div>
  );
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <div className="mx-1 flex w-6 items-center self-center sm:w-8">
      <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-electric to-indigo-400"
          initial={{ width: "0%" }}
          animate={{ width: filled ? "100%" : "0%" }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}
