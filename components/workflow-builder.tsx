"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Calendar,
  Check,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  Square,
  TrendingUp,
  Volume2,
  VolumeX,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { WorkflowDiagram } from "@/components/workflow-diagram";
import { GuaranteePill } from "@/components/guarantee";
import { tiers } from "@/lib/data";
import { getBenchmark, benchmarkLabelKey } from "@/lib/benchmarks";
import { formatCurrency } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useSpeechRecognition, speak, stopSpeaking } from "@/lib/use-speech";
import { useLocale } from "@/lib/locale-context";

type Msg = { role: "user" | "assistant"; content: string };
type Step = { label: string; tool: string };
type Blueprint = {
  title: string;
  summary: string;
  trigger: string;
  steps: Step[];
  tools: string[];
  estimatedSavings: string;
  suggestedTier: "starter" | "growth" | "scale";
  nextStep: string;
  decisionRules?: string[];
  escalation?: string;
  autonomy?: "auto" | "approve";
  roi?: { tasksPerMonth: number; minutesPerTask: number; hourlyCost: number };
};
type Roi = { tasksPerMonth: number; minutesPerTask: number; hourlyCost: number };
type ApiReply = { done: boolean; progress: number; question?: string; blueprint?: Blueprint };

type Phase = "intro" | "asking" | "thinking" | "done";

const CALENDLY = process.env.NEXT_PUBLIC_CALENDLY_URL ?? "https://calendly.com/wardvale/discovery";

type Attachment = { kind: "image" | "text"; name: string; dataUrl?: string; text?: string };
const MAX_FILE_BYTES = 3 * 1024 * 1024;

function readFile(file: File, as: "dataURL" | "text"): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    if (as === "dataURL") reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}

export function WorkflowBuilder({
  industry = "",
  embedded = false,
  onStep,
}: {
  industry?: string;
  embedded?: boolean;
  // Lets a parent dashboard (start-flow) mirror interview progress: how far
  // along, how many answers given, and whether the blueprint is ready.
  onStep?: (info: { progress: number; answered: number; done: boolean }) => void;
} = {}) {
  const { t, locale } = useLocale();
  const [phase, setPhase] = useState<Phase>(industry ? "thinking" : "intro");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState(0);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [voiceOut, setVoiceOut] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { supported, listening, transcript, level, error, start, stop, reset } = useSpeechRecognition();

  // Mirror live speech transcript into the input box.
  useEffect(() => {
    if (listening && transcript) setInput(transcript);
  }, [transcript, listening]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, phase]);

  // Report interview progress to a parent dashboard, if one is listening.
  useEffect(() => {
    onStep?.({
      progress,
      answered: messages.filter((m) => m.role === "user").length,
      done: phase === "done",
    });
  }, [progress, messages, phase, onStep]);

  // Industry chosen up front (Start experience) → begin immediately, skip intro.
  const startedRef = useRef(false);
  useEffect(() => {
    if (industry && !startedRef.current) {
      startedRef.current = true;
      void begin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry]);

  async function call(payload: object): Promise<ApiReply | null> {
    try {
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return (await res.json()) as ApiReply;
    } catch {
      return null;
    }
  }

  function apply(reply: ApiReply | null, history: Msg[]) {
    if (!reply) {
      setMessages([...history, { role: "assistant", content: t("bld.errorRetry") }]);
      setPhase("asking");
      return;
    }
    setProgress(reply.progress ?? progress);
    if (reply.done && reply.blueprint) {
      setBlueprint(reply.blueprint);
      setPhase("done");
      stopSpeaking();
      track("blueprint_generated", { tier: reply.blueprint.suggestedTier });
      return;
    }
    const q = reply.question ?? t("bld.fallbackQuestion");
    setMessages([...history, { role: "assistant", content: q }]);
    setPhase("asking");
    if (voiceOut) speak(q);
  }

  async function begin() {
    track("builder_start");
    setPhase("thinking");
    const reply = await call({ messages: [], industry, locale });
    apply(reply, []);
  }

  async function send() {
    const answer = input.trim();
    if ((!answer && !attachment) || phase === "thinking") return;
    if (listening) stop();
    const content = answer || (attachment ? `(${t("bld.sharedFile")}: ${attachment.name})` : "");
    const history = [...messages, { role: "user" as const, content }];
    const sentAttachment = attachment;
    setMessages(history);
    setInput("");
    setAttachment(null);
    setFileError(null);
    reset();
    setPhase("thinking");
    const reply = await call({ messages: history, attachment: sentAttachment ?? undefined, industry, locale });
    apply(reply, history);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileError(null);
    if (file.size > MAX_FILE_BYTES) {
      setFileError(t("bld.fileTooLarge"));
      return;
    }
    const isImage = file.type.startsWith("image/");
    const isText =
      /^text\//.test(file.type) ||
      /(csv|json|markdown)/.test(file.type) ||
      /\.(txt|csv|md|json|tsv|log)$/i.test(file.name);
    try {
      if (isImage) {
        const dataUrl = await readFile(file, "dataURL");
        // Match the server's inline-image cap (data-URL length) so oversize images
        // get a clear rejection here instead of being silently dropped server-side.
        if (dataUrl.length >= 1_500_000) {
          setFileError(t("bld.fileTooLarge"));
          return;
        }
        setAttachment({ kind: "image", name: file.name, dataUrl });
        track("builder_attachment", { kind: "image" });
      } else if (isText) {
        const text = (await readFile(file, "text")).slice(0, 8000);
        setAttachment({ kind: "text", name: file.name, text });
        track("builder_attachment", { kind: "text" });
      } else {
        setFileError(t("bld.fileWrongType"));
      }
    } catch {
      setFileError(t("bld.fileReadError"));
    }
  }

  function toggleMic() {
    if (!supported) return;
    if (listening) stop();
    else {
      setInput("");
      start();
    }
  }

  function toggleVoiceOut() {
    setVoiceOut((v) => {
      if (v) stopSpeaking();
      return !v;
    });
  }

  return (
    <div className={embedded ? "" : "mx-auto max-w-3xl"}>
      <div className={embedded ? "overflow-hidden rounded-3xl" : "gradient-border glass-strong overflow-hidden rounded-3xl"}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-electric to-indigo-400 text-navy-900">
              <Wand2 className="h-4 w-4" />
            </span>
            <span className="font-display text-sm font-semibold">{t("bld.builderTitle")}</span>
          </div>
          <button
            onClick={toggleVoiceOut}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
            aria-label={t("bld.toggleVoice")}
          >
            {voiceOut ? <Volume2 className="h-3.5 w-3.5 text-cyan-electric" /> : <VolumeX className="h-3.5 w-3.5" />}
            {/* Icon-only on phones — the label clipped at 375px widths. */}
            <span className="hidden sm:inline">{voiceOut ? t("bld.voiceOn") : t("bld.voiceOff")}</span>
          </button>
        </div>

        {/* Progress */}
        {phase !== "intro" && (
          <div className="h-1 w-full bg-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-electric to-indigo-400"
              animate={{ width: `${phase === "done" ? 100 : progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}

        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait" initial={false}>
            {/* Intro */}
            {phase === "intro" && (
              <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-6 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1 text-xs font-medium text-cyan-electric">
                  <Sparkles className="h-3 w-3" /> {t("bld.introBadge")}
                </span>
                <h3 className="mt-4 font-display text-2xl font-semibold">
                  {t("bld.introTitle")}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                  {t("bld.introSubtitle")}
                </p>
                <Button size="lg" className="mt-6" onClick={begin}>
                  <Bot className="h-4 w-4" /> {t("bld.startBuilding")}
                </Button>
                {supported && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    <Mic className="mr-1 inline h-3 w-3" /> {t("bld.voiceSupported")}
                  </p>
                )}
              </motion.div>
            )}

            {/* Q&A */}
            {(phase === "asking" || phase === "thinking") && (
              <motion.div key="qa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div ref={scrollRef} role="log" aria-live="polite" aria-atomic="false" className="max-h-80 space-y-3 overflow-y-auto pr-1">
                  {messages.map((m, i) => (
                    <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                      <div
                        className={
                          m.role === "user"
                            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-electric/15 px-4 py-2.5 text-[15px] text-foreground"
                            : "flex w-full gap-2.5 rounded-2xl rounded-bl-sm bg-white/5 px-4 py-3 text-[15px]"
                        }
                      >
                        {m.role === "assistant" && <Bot className="mt-0.5 h-4 w-4 shrink-0 text-cyan-electric" />}
                        <span className="text-muted-foreground">{m.content}</span>
                      </div>
                    </div>
                  ))}
                  {phase === "thinking" && (
                    <div role="status" className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-electric" />
                      {t("bld.thinking")}
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="mt-5">
                  <AnimatePresence>
                    {listening && (
                      <motion.div
                        key="dictation"
                        initial={{ opacity: 0, y: 6, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: 6, height: 0 }}
                        className="mb-2 flex items-center gap-3 overflow-hidden rounded-2xl border border-cyan-electric/40 bg-cyan-electric/10 px-4 py-2.5"
                      >
                        <Waveform level={level} />
                        <span className="text-sm font-medium text-cyan-electric">{t("bld.listening")}</span>
                        <button
                          onClick={stop}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-cyan-electric px-3 py-1 text-xs font-semibold text-navy-900"
                        >
                          <Square className="h-3 w-3 fill-current" /> {t("bld.stop")}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {attachment && (
                    <div className="mb-2 flex items-center gap-2 rounded-xl border border-cyan-electric/30 bg-cyan-electric/10 px-3 py-2 text-sm">
                      {attachment.kind === "image" && attachment.dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={attachment.dataUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-cyan-electric" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                      <button
                        onClick={() => setAttachment(null)}
                        aria-label={t("bld.removeAttachment")}
                        className="shrink-0 text-muted-foreground transition hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.txt,.csv,.md,.json,.tsv,.log"
                    className="hidden"
                    onChange={(e) => {
                      handleFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <div className={`flex items-end gap-1.5 rounded-2xl border bg-card/40 p-1.5 transition-colors ${listening ? "border-cyan-electric/50" : "border-border focus-within:border-cyan-electric/50"}`}>
                    <textarea
                      value={input}
                      aria-label={t("start.answerLabel")}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      rows={1}
                      placeholder={listening ? t("bld.placeholderListening") : t("bld.placeholderIdle")}
                      className="max-h-32 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none"
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      aria-label={t("bld.attachFile")}
                      title={t("bld.attachTitle")}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition hover:text-cyan-electric"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    {supported && (
                      <button
                        onClick={toggleMic}
                        aria-label={t("bld.voiceInput")}
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${
                          listening
                            ? "animate-pulse bg-red-500/20 text-red-400"
                            : "border border-border text-muted-foreground hover:text-cyan-electric"
                        }`}
                      >
                        <Mic className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={send}
                      disabled={(!input.trim() && !attachment) || phase === "thinking"}
                      aria-label={t("bld.send")}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-electric to-indigo-400 text-navy-900 transition disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  {error || fileError ? (
                    <p className="mt-2 text-center text-xs text-red-400">{fileError || error}</p>
                  ) : (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      {listening ? t("bld.helperListening") : t("bld.helperIdle")}
                    </p>
                  )}
                  {!supported && (
                    <p className="mt-1 text-center text-[11px] text-muted-foreground/70">
                      {t("bld.voiceBrowsers")}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Blueprint */}
            {phase === "done" && blueprint && (
              <BlueprintCard
                key="done"
                blueprint={blueprint}
                industry={industry}
                businessType={messages.find((m) => m.role === "user")?.content}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function BlueprintCard({ blueprint, businessType, industry }: { blueprint: Blueprint; businessType?: string; industry?: string }) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const roi: Roi = blueprint.roi ?? { tasksPerMonth: 400, minutesPerTask: 5, hourlyCost: 25 };

  // Pre-fill the strategy-call booking with everything we've captured (same
  // Calendly query-param pattern as the contact form): name, email, a1=industry,
  // a2=the tailored blueprint. Recomputes as the visitor types their details.
  const bookUrl = (() => {
    const params = new URLSearchParams();
    if (name.trim()) params.set("name", name.trim());
    if (email.trim()) params.set("email", email.trim());
    const a1 = industry || businessType || blueprint.title;
    if (a1) params.set("a1", a1);
    params.set("a2", blueprint.title);
    const q = params.toString();
    if (!q) return CALENDLY;
    return `${CALENDLY}${CALENDLY.includes("?") ? "&" : "?"}${q}`;
  })();

  async function emailMe() {
    if (!email.trim()) return;
    setSending(true);
    try {
      await fetch("/api/workflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "email", name, email, businessType, blueprint }),
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-cyan-electric" />
        <h3 className="font-display text-xl font-semibold">{blueprint.title}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{blueprint.summary}</p>

      {(() => {
        const bench = getBenchmark(industry || businessType || "");
        if (!bench) return null;
        return (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-indigo-400/25 bg-indigo-400/10 p-3 text-sm">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{t(benchmarkLabelKey(bench.vertical))}{t("bld.benchLikeYou")}</span> {t("bld.benchSaveAround")}{" "}
              <span className="font-medium text-cyan-electric">${bench.avgMonthlySavings.toLocaleString()}{t("bld.benchPerMo")}</span> {t("bld.benchCutReply")}{" "}
              {t(bench.replyTimeBefore)} {t("bld.benchTo")} {t(bench.replyTimeAfter)}.
            </p>
          </div>
        );
      })()}

      {/* Animated flow + run simulation */}
      <div className="mt-5">
        <WorkflowDiagram
          trigger={blueprint.trigger}
          steps={blueprint.steps}
          savedPerRun={roi.minutesPerTask}
        />
      </div>

      {/* What makes this agent sharp: the rules it follows and when it defers. */}
      {(blueprint.decisionRules?.length || blueprint.escalation) && (
        <div className="mt-5 rounded-2xl border border-border bg-card/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
              {t("start.agentRules")}
            </p>
            {blueprint.autonomy && (
              <span className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                {t(blueprint.autonomy === "auto" ? "start.autonomyAuto" : "start.autonomyApprove")}
              </span>
            )}
          </div>
          {blueprint.decisionRules?.length ? (
            <ul className="mt-3 space-y-1.5">
              {blueprint.decisionRules.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-electric" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {blueprint.escalation && (
            <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t("start.escalates")}</span> {blueprint.escalation}
            </p>
          )}
        </div>
      )}

      {/* Computed, adjustable ROI */}
      <RoiPanel roi={roi} suggestedTier={blueprint.suggestedTier} />

      {blueprint.tools.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {blueprint.tools.map((tl, i) => (
            <span key={`${tl}-${i}`} className="rounded-full border border-border bg-card/50 px-2.5 py-1 text-xs text-muted-foreground">
              {tl}
            </span>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a href={bookUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button size="lg" className="w-full">
            <Calendar className="h-4 w-4" /> {t("start.bookPrefilled")}
          </Button>
        </a>
      </div>
      <div className="mt-3 flex justify-center">
        <GuaranteePill />
      </div>

      {/* Email capture */}
      <div className="mt-4 rounded-2xl border border-border bg-card/40 p-4">
        {sent ? (
          <p className="flex items-center gap-2 text-sm text-emerald-300">
            <Check className="h-4 w-4" /> {t("bld.emailSent")}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">{t("bld.emailPrompt")}</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label={t("bld.namePlaceholder")}
                placeholder={t("bld.namePlaceholder")}
                className="rounded-xl border border-border bg-card/40 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-cyan-electric/50 focus:outline-none sm:w-40"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label={t("bld.emailPlaceholder")}
                placeholder={t("bld.emailPlaceholder")}
                className="flex-1 rounded-xl border border-border bg-card/40 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-cyan-electric/50 focus:outline-none"
              />
              <Button onClick={emailMe} disabled={!email.trim() || sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t("bld.send")}
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// Live mic waveform — bars react to the audio level (0–1) from the hook.
function Waveform({ level }: { level: number }) {
  const factors = [0.45, 0.8, 1, 0.62, 0.95, 0.5, 0.88, 0.7, 1, 0.58, 0.82];
  return (
    <div className="flex h-6 items-center gap-0.5" aria-hidden>
      {factors.map((f, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-cyan-electric transition-[height] duration-100 ease-out"
          style={{ height: `${Math.max(12, Math.min(100, (0.14 + level * f) * 100))}%` }}
        />
      ))}
    </div>
  );
}

function RoiPanel({ roi, suggestedTier }: { roi: Roi; suggestedTier: "starter" | "growth" | "scale" }) {
  const { t } = useLocale();
  const [tasks, setTasks] = useState(roi.tasksPerMonth);
  const [minutes, setMinutes] = useState(roi.minutesPerTask);
  const [cost, setCost] = useState(roi.hourlyCost);

  const hours = (tasks * minutes) / 60;
  const monthly = Math.round(hours * cost);
  const tier = tiers.find((tr) => tr.id === suggestedTier) ?? tiers[1];
  const net = monthly - tier.price;
  const paybackDays = monthly > 0 ? Math.max(1, Math.round((tier.price / monthly) * 30)) : null;
  const taskMax = Math.max(4000, Math.ceil(roi.tasksPerMonth / 500) * 500);

  return (
    <div className="mt-4 rounded-2xl border border-cyan-electric/25 bg-cyan-electric/[0.06] p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">{t("bld.roiTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("bld.roiDrag")}</p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Slider label={t("bld.roiRunsMonth")} min={10} max={taskMax} step={10} value={tasks} onChange={setTasks} format={(v) => v.toLocaleString()} />
        <Slider label={t("bld.roiMinutesRun")} min={1} max={60} step={1} value={minutes} onChange={setMinutes} format={(v) => `${v}m`} />
        <Slider label={t("bld.roiHourlyCost")} min={15} max={120} step={1} value={cost} onChange={setCost} format={(v) => `$${v}`} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label={t("bld.roiLaborSaved")} value={formatCurrency(monthly)} sub={`${Math.round(hours)}${t("bld.roiHoursMonth")}`} highlight />
        <Metric label={`${t("bld.netAfter")} ${t(tier.name)}`} value={`${net >= 0 ? "+" : ""}${formatCurrency(net)}`} sub={`${formatCurrency(tier.price)}${t("bld.perMoRetainer")}`} />
        <Metric label={t("bld.payback")} value={paybackDays ? `${paybackDays} ${t("bld.days")}` : "—"} sub={net >= 0 ? t("bld.thenUpside") : t("bld.raiseVolume")} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {t("bld.estimatePrefix")} {t(tier.name)}{t("bld.estimateSuffix")}
      </p>
    </div>
  );
}

function Metric({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-cyan-electric/40 bg-cyan-electric/10" : "border-border bg-card/40"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold tabular-nums ${highlight ? "gradient-text" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, format }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-display text-sm text-foreground tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-electric"
      />
    </label>
  );
}
