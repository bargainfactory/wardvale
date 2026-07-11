"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Calendar, Loader2, Sparkles, Zap } from "lucide-react";
import { FormEvent, useState } from "react";
import Script from "next/script";
import { SectionHeader } from "@/components/services";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import { track } from "@/lib/analytics";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type QuoteState = "form" | "loading" | "ideas";

type Idea = { title: string; description: string; savingsEstimate: string };

export function ContactForm() {
  const { t } = useLocale();

  const businessTypes = [t("biz.restaurant"), t("biz.ecom"), t("biz.consulting"), t("biz.local"), t("biz.health"), t("biz.realestate"), t("biz.other")];
  const [state, setState] = useState<QuoteState>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [biz, setBiz] = useState(businessTypes[0]);
  const [painPoints, setPainPoints] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);

  async function submit(e: FormEvent) {
    e.preventDefault();

    // Read the Turnstile token from the widget's injected hidden input (if any).
    const form = e.currentTarget as HTMLFormElement;
    const turnstileToken =
      (form.elements.namedItem("cf-turnstile-response") as HTMLInputElement | null)?.value ||
      undefined;

    setState("loading");
    track("quote_submitted", { businessType: biz });

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, businessType: biz, painPoints, turnstileToken }),
      });
      const data = (await res.json()) as { ideas?: Idea[] };
      setIdeas(
        data.ideas ?? [
          {
            title: "Inbox Triage Agent",
            description: "AI reads & drafts replies to every inbound email in your voice.",
            savingsEstimate: "~$800/mo",
          },
          {
            title: "Lead Capture Flow",
            description: "Every form, DM, and missed call → CRM + instant reply.",
            savingsEstimate: "~$1,200/mo",
          },
          {
            title: "Review Response Bot",
            description: "Auto-reply to Google/Yelp reviews within 15 minutes.",
            savingsEstimate: "~$400/mo",
          },
        ]
      );
    } catch {
      setIdeas([
        {
          title: "Inbox Triage Agent",
          description: "AI reads & drafts replies to every inbound email in your voice.",
          savingsEstimate: "~$800/mo",
        },
        {
          title: "Lead Capture Flow",
          description: "Every form, DM, and missed call → CRM + instant reply.",
          savingsEstimate: "~$1,200/mo",
        },
        {
          title: "Review Response Bot",
          description: "Auto-reply to Google/Yelp reviews within 15 minutes.",
          savingsEstimate: "~$400/mo",
        },
      ]);
    } finally {
      setState("ideas");
    }
  }

  const calendlyUrl =
    typeof window !== "undefined"
      ? `${process.env.NEXT_PUBLIC_CALENDLY_URL ?? "https://calendly.com/flowforge/discovery"}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&a1=${encodeURIComponent(biz)}`
      : "#";

  return (
    <section id="quote" className="relative py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow={t("quote.eyebrow")}
          title={
            <>
              {t("quote.title.1")} <span className="gradient-text">{t("quote.title.2")}</span> {t("quote.title.3")}
            </>
          }
          sub={t("quote.sub")}
        />

        <div className="relative mx-auto mt-14 max-w-3xl">
          <div className="gradient-border glass-strong overflow-hidden rounded-3xl p-8 md:p-10">
            <AnimatePresence mode="wait">
              {state === "form" && (
                <motion.form
                  key="form"
                  onSubmit={submit}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-5"
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label={t("quote.name")} required>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Maria Santos"
                        className="w-full rounded-xl border border-border bg-card/40 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-cyan-electric/50 focus:outline-none focus:ring-1 focus:ring-cyan-electric/30"
                      />
                    </Field>
                    <Field label={t("quote.email")} required>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="maria@nonabistro.com"
                        className="w-full rounded-xl border border-border bg-card/40 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-cyan-electric/50 focus:outline-none focus:ring-1 focus:ring-cyan-electric/30"
                      />
                    </Field>
                  </div>

                  <Field label={t("quote.bizType")} required>
                    <select
                      value={biz}
                      onChange={(e) => setBiz(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card/40 px-4 py-3 text-sm focus:border-cyan-electric/50 focus:outline-none focus:ring-1 focus:ring-cyan-electric/30"
                    >
                      {businessTypes.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label={t("quote.pain")} required={false}>
                    <textarea
                      value={painPoints}
                      onChange={(e) => setPainPoints(e.target.value)}
                      rows={3}
                      placeholder={t("quote.painPlaceholder")}
                      className="w-full rounded-xl border border-border bg-card/40 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-cyan-electric/50 focus:outline-none focus:ring-1 focus:ring-cyan-electric/30"
                    />
                  </Field>

                  {TURNSTILE_SITE_KEY && (
                    <>
                      <Script
                        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                        async
                        defer
                      />
                      <div
                        className="cf-turnstile"
                        data-sitekey={TURNSTILE_SITE_KEY}
                        data-theme="dark"
                      />
                    </>
                  )}

                  <Button type="submit" size="lg" className="w-full md:w-auto">
                    <Sparkles className="h-4 w-4" />
                    {t("quote.submit")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    {t("quote.noCC")}
                  </p>
                </motion.form>
              )}

              {state === "loading" && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <Loader2 className="h-10 w-10 animate-spin text-cyan-electric" />
                  <p className="mt-4 font-display text-lg font-medium">
                    {t("quote.analyzing")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("quote.analyzingSub")}
                  </p>
                </motion.div>
              )}

              {state === "ideas" && (
                <motion.div
                  key="ideas"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-cyan-electric" />
                    <h3 className="font-display text-xl font-semibold">
                      {t("quote.yourScope")} {name.split(" ")[0] || "friend"}
                    </h3>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("quote.matched")}{" "}
                    <span className="text-foreground">{biz}</span>
                  </p>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {ideas.map((idea, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.12 }}
                        className="rounded-2xl border border-border bg-card/40 p-5"
                      >
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-electric/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-electric">
                          {t("quote.idea")} {i + 1}
                        </span>
                        <h4 className="mt-3 font-semibold">{idea.title}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {idea.description}
                        </p>
                        <p className="mt-3 font-display text-lg font-semibold text-cyan-electric tabular-nums">
                          {idea.savingsEstimate}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
                    <a href={calendlyUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="lg">
                        <Calendar className="h-4 w-4" />
                        {t("quote.bookCall")}
                      </Button>
                    </a>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => setState("form")}
                    >
                      {t("quote.adjust")}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-cyan-electric"> *</span>}
      </span>
      {children}
    </label>
  );
}
