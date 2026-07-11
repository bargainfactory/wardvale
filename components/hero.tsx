"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles, Mail, Bot, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const workflow = [
  {
    icon: Mail,
    label: "Lead lands",
    sub: "Form · DM · Missed call",
    accent: "from-cyan-electric/20 to-cyan-electric/5",
  },
  {
    icon: Bot,
    label: "Agent qualifies",
    sub: "GPT scores · drafts reply",
    accent: "from-indigo-500/20 to-indigo-500/5",
  },
  {
    icon: Calendar,
    label: "Meeting booked",
    sub: "Calendly · CRM · Slack",
    accent: "from-emerald-400/20 to-emerald-400/5",
  },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 lg:pt-40 lg:pb-32">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-grid-glow dark:bg-mesh-dark" />

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <Badge className="mb-6">
            <Sparkles className="h-3 w-3" />
            Premium AI automation for small business
          </Badge>

          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[64px] lg:leading-[1.05]">
            Ship revenue-grade{" "}
            <span className="gradient-text">automations</span> in 14 days —{" "}
            <span className="text-muted-foreground">not 14 weeks.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            FlowForge AI builds done-for-you Zapier flows and custom GPT agents for
            restaurants, e-com stores and local service owners. Recurring retainers
            from <span className="text-foreground font-medium">$500/mo</span>.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() =>
                document.getElementById("quote")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Get my free 60s audit
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() =>
                document.getElementById("results")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              <Play className="h-4 w-4" />
              See live results
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            No credit card · 14-day build · 21-day ROI guarantee
          </p>
        </motion.div>

        <WorkflowDemo />

        <TrustRow />
      </div>
    </section>
  );
}

function WorkflowDemo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="relative mx-auto mt-16 max-w-5xl"
    >
      <div className="gradient-border relative overflow-hidden rounded-3xl glass-strong shadow-glow">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-cyan-electric" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-electric" />
            </span>
            flowforge.ai / live-flow-demo
          </div>
          <span className="text-xs text-muted-foreground">auto-play</span>
        </div>

        <div className="relative p-8 md:p-12">
          <div className="grid gap-4 md:grid-cols-3">
            {workflow.map((step, i) => (
              <WorkflowStep key={i} step={step} i={i} />
            ))}
          </div>

          <FlowConnector />

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm md:flex-row">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              Run completed in <span className="text-foreground font-medium">1.8s</span>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>Leads captured today: <span className="text-foreground font-medium tabular-nums">142</span></span>
              <span>·</span>
              <span>Hours saved: <span className="text-foreground font-medium tabular-nums">37.4</span></span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function WorkflowStep({
  step,
  i,
}: {
  step: (typeof workflow)[number];
  i: number;
}) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0.3, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: i * 0.25,
        repeat: Infinity,
        repeatType: "reverse",
        repeatDelay: 2,
      }}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${step.accent} p-5`}
    >
      <div className="flex items-center justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 backdrop-blur">
          <Icon className="h-5 w-5 text-cyan-electric" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Step {i + 1}
        </span>
      </div>
      <p className="mt-4 font-medium">{step.label}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{step.sub}</p>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-electric to-indigo-400"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{
            duration: 1.6,
            delay: i * 0.5,
            repeat: Infinity,
            repeatDelay: 1.5,
            ease: "easeInOut",
          }}
        />
      </div>
    </motion.div>
  );
}

function FlowConnector() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-8 top-1/2 -z-0 hidden h-16 -translate-y-1/2 md:block"
      viewBox="0 0 800 40"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="flow-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity="0" />
          <stop offset="50%" stopColor="#00e5ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1="0"
        y1="20"
        x2="800"
        y2="20"
        stroke="url(#flow-grad)"
        strokeWidth="2"
        strokeDasharray="6 8"
        className="animate-flow-dash"
      />
    </svg>
  );
}

function TrustRow() {
  const logos = ["Zapier", "OpenAI", "Stripe", "HubSpot", "Shopify", "Calendly"];
  return (
    <div className="mt-16 flex flex-col items-center gap-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Built on the stack your business already trusts
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 opacity-70">
        {logos.map((l) => (
          <span
            key={l}
            className="font-display text-lg font-semibold tracking-tight text-muted-foreground"
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
