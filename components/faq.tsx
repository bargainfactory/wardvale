"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageCircle, Send } from "lucide-react";
import { useState, useRef, FormEvent } from "react";
import { faq } from "@/lib/data";
import { SectionHeader } from "@/components/services";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";

export function FAQ() {
  const { t } = useLocale();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow={t("faq.eyebrow")}
          title={
            <>
              {t("faq.title.1")} <span className="gradient-text">{t("faq.title.2")}</span>
            </>
          }
          sub={t("faq.sub")}
        />

        <div className="mx-auto mt-14 grid max-w-6xl gap-8 lg:grid-cols-2">
          <div className="space-y-2">
            {faq.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card/40 backdrop-blur transition"
              >
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-sm font-medium transition"
                >
                  <span>{t(`faq.${i+1}.q`)}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      open === i && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-sm text-muted-foreground">
                        {t(`faq.${i+1}.a`)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          <Chatbot />
        </div>
      </div>
    </section>
  );
}

type Message = { role: "user" | "assistant"; content: string };

function Chatbot() {
  const { t } = useLocale();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: t("chat.welcome"),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      const data = (await res.json()) as { reply?: string };
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? "Sorry, something went wrong. Try again." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "I'm having trouble connecting. Please try again." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="flex h-[480px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-navy-950/60 backdrop-blur-lg lg:h-auto">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
        <MessageCircle className="h-4 w-4 text-cyan-electric" />
        <span className="text-sm font-medium">{t("chat.title")}</span>
        <span className="relative ml-auto flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
              m.role === "user"
                ? "ml-auto bg-cyan-electric/15 text-foreground"
                : "bg-white/[0.05] text-muted-foreground"
            )}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="max-w-[85%] rounded-2xl bg-white/[0.05] px-4 py-3 text-sm text-muted-foreground">
            <span className="shimmer inline-block h-4 w-32 rounded" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-white/10 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chat.placeholder")}
          className="flex-1 rounded-full bg-white/5 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-electric/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-electric text-navy-900 transition hover:shadow-glow disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
