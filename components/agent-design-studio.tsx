"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Mic,
  MicOff,
  Plug,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import { PACKS, AGENTS, type AgentKey, type Plan, type Schedule } from "@/lib/agents-catalog";
import { planFromIntake, type StudioIntake } from "@/lib/studio-generator";
import { useSpeechRecognition } from "@/lib/use-speech";

// The post-signup Agent Design Studio: a progressive, localized questionnaire
// (answerable by form OR voice) that maps to a reviewable draft config, applied
// on confirm. Reuses the wizard's Section/Field visual language. One StudioIntake
// object is the single source of truth; both the form and the "talk it through"
// path fill it, and planFromIntake renders the review preview client-side.

const REGULATED = new Set(["clinic", "law-firm"]);

// Goal options presented as outcomes, each mapping to one agent key.
const GOALS: { key: AgentKey; labelKey: string }[] = [
  { key: "inbox-triage", labelKey: "studio.goalInbox" },
  { key: "support-triage", labelKey: "studio.goalSupport" },
  { key: "lead-qualification", labelKey: "studio.goalLead" },
  { key: "review-request", labelKey: "studio.goalReview" },
  { key: "cart-recovery", labelKey: "studio.goalCart" },
  { key: "ar-followup", labelKey: "studio.goalAr" },
  // Wave 2 (July 2026 pain-point research)
  { key: "winback", labelKey: "studio.goalWinback" },
  { key: "quote-followup", labelKey: "studio.goalQuote" },
  { key: "hiring-assist", labelKey: "studio.goalHiring" },
  { key: "referral-ask", labelKey: "studio.goalReferral" },
  { key: "noshow-shield", labelKey: "studio.goalNoshow" },
  { key: "review-response", labelKey: "studio.goalRevResp" },
  { key: "shift-cover", labelKey: "studio.goalShift" },
  { key: "content-drafter", labelKey: "studio.goalContent" },
  { key: "doc-chaser", labelKey: "studio.goalDocs" },
  { key: "dispute-fighter", labelKey: "studio.goalDispute" },
];

const inputCls =
  "w-full rounded-lg border border-border bg-card/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-cyan-electric";

type VoiceMsg = { role: "user" | "assistant"; content: string };

export function AgentDesignStudio({ initial, plan, locale }: { initial: StudioIntake; plan: Plan; locale: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [intake, setIntake] = useState<StudioIntake>(initial);
  const [mode, setMode] = useState<"form" | "voice">("form");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);

  // Debounced autosave of the raw answers (never applies config).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: StudioIntake) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/portal/studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", intake: { ...next, version: 1 } }),
      }).catch(() => {});
    }, 700);
  }, []);

  const update = useCallback(
    (patch: Partial<StudioIntake> | ((prev: StudioIntake) => StudioIntake)) => {
      setIntake((prev) => {
        const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const regulated = REGULATED.has(intake.vertical ?? "");
  // Conditional section list — advanced only when opted in.
  const sections = useMemo(() => {
    const base = ["presets", "context", "goals", "tools", "autonomy", "constraints"];
    if (intake.advancedOptIn) base.push("advanced");
    base.push("review");
    return base;
  }, [intake.advancedOptIn]);

  const current = sections[Math.min(step, sections.length - 1)];
  const isReview = current === "review";
  const progress = Math.round((step / (sections.length - 1)) * 100);

  const goNext = () => setStep((s) => Math.min(s + 1, sections.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));
  const skip = () => {
    update((prev) => ({ ...prev, skipped: Array.from(new Set([...(prev.skipped ?? []), current])) }));
    goNext();
  };

  async function apply() {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "apply", intake: { ...intake, version: 1 } }),
      });
      if (res.ok) {
        setApplied(true);
        router.push("/portal");
        return;
      }
    } catch {
      /* fall through */
    }
    setSaving(false);
  }

  return (
    <PageLayout>
      <div className="container max-w-3xl pb-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">{t("studio.eyebrow")}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold">{t("studio.title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("studio.subtitle")}</p>
          </div>
          <div className="flex rounded-full border border-border bg-card/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("form")}
              className={`rounded-full px-3 py-1.5 transition ${mode === "form" ? "bg-cyan-electric/15 text-cyan-electric" : "text-muted-foreground"}`}
            >
              <Wand2 className="mr-1 inline h-3.5 w-3.5" /> {t("studio.modeForm")}
            </button>
            <button
              type="button"
              onClick={() => setMode("voice")}
              className={`rounded-full px-3 py-1.5 transition ${mode === "voice" ? "bg-cyan-electric/15 text-cyan-electric" : "text-muted-foreground"}`}
            >
              <Mic className="mr-1 inline h-3.5 w-3.5" /> {t("studio.modeVoice")}
            </button>
          </div>
        </div>

        {mode === "voice" ? (
          <VoicePanel
            locale={locale}
            onComplete={(partial) => {
              update((prev) => mergeIntake(prev, partial));
              setMode("form");
              setStep(sections.indexOf("review"));
            }}
            t={t}
          />
        ) : (
          <>
            {/* Progress */}
            <div className="mb-6">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>
                  {t("studio.stepLabel")} {Math.min(step + 1, sections.length)}/{sections.length}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-cyan-electric transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {current === "presets" && <PresetsSection intake={intake} update={update} t={t} />}
            {current === "context" && <ContextSection intake={intake} update={update} t={t} />}
            {current === "goals" && <GoalsSection intake={intake} update={update} t={t} />}
            {current === "tools" && <ToolsSection intake={intake} update={update} t={t} />}
            {current === "autonomy" && <AutonomySection intake={intake} update={update} regulated={regulated} t={t} />}
            {current === "constraints" && <ConstraintsSection intake={intake} update={update} regulated={regulated} t={t} />}
            {current === "advanced" && <AdvancedSection intake={intake} update={update} t={t} />}
            {isReview && <ReviewSection intake={intake} update={update} plan={plan} t={t} />}

            {/* Nav */}
            <div className="mt-8 flex items-center gap-3">
              {step > 0 && (
                <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" /> {t("studio.back")}
                </button>
              )}
              <div className="flex-1" />
              {!isReview ? (
                <>
                  <button type="button" onClick={skip} className="text-sm text-muted-foreground hover:text-foreground">
                    {t("studio.skip")}
                  </button>
                  <Button onClick={goNext}>
                    {t("studio.next")} <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={apply} disabled={saving || applied}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? t("studio.applying") : t("studio.apply")}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────

type SectionProps = {
  intake: StudioIntake;
  update: (patch: Partial<StudioIntake> | ((p: StudioIntake) => StudioIntake)) => void;
  t: (k: string) => string;
};

function Shell({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function PresetsSection({ intake, update, t }: SectionProps) {
  return (
    <Shell title={t("studio.presetsTitle")} hint={t("studio.presetsHint")}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PACKS.map((p) => {
          const active = intake.vertical === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                update((prev) => ({
                  ...prev,
                  vertical: active ? "" : p.id,
                  context: { ...prev.context, industry: prev.context?.industry || p.industry, tone: prev.context?.tone || p.tone },
                  goals: { ...prev.goals, agents: Array.from(new Set([...(prev.goals?.agents ?? []), ...p.agents])) },
                }))
              }
              className={`rounded-2xl border p-4 text-left transition ${active ? "border-cyan-electric bg-cyan-electric/10" : "border-border bg-card/40 hover:border-cyan-electric/40"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold">{p.name}</span>
                {active ? <Check className="h-4 w-4 text-cyan-electric" /> : <Sparkles className="h-4 w-4 text-muted-foreground" />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.industry}</p>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => update({ vertical: "" })}
        className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {t("studio.scratch")}
      </button>
    </Shell>
  );
}

function ContextSection({ intake, update, t }: SectionProps) {
  const c = intake.context ?? {};
  const set = (k: keyof NonNullable<StudioIntake["context"]>) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    update((prev) => ({ ...prev, context: { ...prev.context, [k]: e.target.value } }));
  return (
    <Shell title={t("studio.ctxTitle")} hint={t("studio.ctxHint")}>
      <div className="grid gap-4">
        <Field label={t("studio.fIndustry")}><input value={c.industry ?? ""} onChange={set("industry")} className={inputCls} /></Field>
        <Field label={t("studio.fHours")}><input value={c.hours ?? ""} onChange={set("hours")} className={inputCls} /></Field>
        <Field label={t("studio.fServices")}><textarea value={c.services ?? ""} onChange={set("services")} rows={2} className={inputCls} /></Field>
        <Field label={t("studio.fPricing")}><textarea value={c.pricing ?? ""} onChange={set("pricing")} rows={2} className={inputCls} /></Field>
        <Field label={t("studio.fFaq")}><textarea value={c.faq ?? ""} onChange={set("faq")} rows={4} className={inputCls} /></Field>
        <Field label={t("studio.fTone")}><input value={c.tone ?? ""} onChange={set("tone")} className={inputCls} /></Field>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(intake.advancedOptIn)}
            onChange={(e) => update({ advancedOptIn: e.target.checked })}
            className="h-4 w-4 accent-cyan-electric"
          />
          {t("studio.advancedToggle")}
        </label>
      </div>
    </Shell>
  );
}

function GoalsSection({ intake, update, t }: SectionProps) {
  const selected = new Set(intake.goals?.agents ?? []);
  const toggle = (key: AgentKey) =>
    update((prev) => {
      const cur = new Set(prev.goals?.agents ?? []);
      if (cur.has(key)) cur.delete(key);
      else cur.add(key);
      return { ...prev, goals: { ...prev.goals, agents: Array.from(cur) } };
    });
  return (
    <Shell title={t("studio.goalsTitle")} hint={t("studio.goalsHint")}>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {GOALS.map((g) => {
          const active = selected.has(g.key);
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => toggle(g.key)}
              className={`flex items-center justify-between rounded-2xl border p-3.5 text-left text-sm transition ${active ? "border-cyan-electric bg-cyan-electric/10" : "border-border bg-card/40 hover:border-cyan-electric/40"}`}
            >
              <span>{t(g.labelKey)}</span>
              {active && <Check className="h-4 w-4 text-cyan-electric" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <Field label={t("studio.successMetric")}>
          <input
            value={intake.goals?.successMetric ?? ""}
            onChange={(e) => update((prev) => ({ ...prev, goals: { ...prev.goals, successMetric: e.target.value } }))}
            className={inputCls}
          />
        </Field>
      </div>
    </Shell>
  );
}

type ToolRow = { id: string; label: string; kind: string; endpoint: string; enabled: boolean; status: string };

function ToolsSection({ t }: SectionProps) {
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [form, setForm] = useState({ label: "", kind: "mcp", endpoint: "", token: "" });
  const [testing, setTesting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; tools?: { name: string }[]; error?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/portal/tools");
      const d = await r.json();
      setTools(d.tools ?? []);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function test() {
    setTesting(true);
    setTestResult(null);
    setErr(null);
    try {
      const r = await fetch("/api/portal/tools/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      setTestResult(await r.json());
    } catch {
      setErr(t("studio.byoErr"));
    }
    setTesting(false);
  }

  async function add() {
    setAdding(true);
    setErr(null);
    try {
      const r = await fetch("/api/portal/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error === "secret_storage_unavailable" ? t("studio.byoSecretWarn") : t("studio.byoErr"));
      else {
        setForm({ label: "", kind: "mcp", endpoint: "", token: "" });
        setTestResult(null);
        await load();
      }
    } catch {
      setErr(t("studio.byoErr"));
    }
    setAdding(false);
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch("/api/portal/tools", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    }).catch(() => {});
    load();
  }
  async function remove(id: string) {
    await fetch("/api/portal/tools", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    load();
  }

  return (
    <Shell title={t("studio.toolsTitle")} hint={t("studio.toolsHint")}>
      <Link
        href="/connections"
        target="_blank"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-4 py-2 text-sm transition hover:border-cyan-electric/40 hover:text-cyan-electric"
      >
        <Plug className="h-4 w-4" /> {t("studio.toolsConnect")}
      </Link>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="font-display text-base font-semibold">{t("studio.byoTitle")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("studio.byoHint")}</p>

        {tools.length > 0 && (
          <div className="mt-4 space-y-2">
            {tools.map((tool) => (
              <div key={tool.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/30 p-3 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{tool.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{tool.kind}</span>
                  {tool.status === "error" && <span className="ml-2 text-xs text-red-400">{t("studio.byoTestFail")}</span>}
                  <p className="truncate text-xs text-muted-foreground">{tool.endpoint}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(tool.id, !tool.enabled)}
                    className={`rounded-full px-2.5 py-1 text-xs transition ${tool.enabled ? "bg-cyan-electric/15 text-cyan-electric" : "border border-border text-muted-foreground"}`}
                  >
                    {tool.enabled ? t("studio.byoEnabled") : t("studio.byoDisabled")}
                  </button>
                  <button type="button" onClick={() => remove(tool.id)} aria-label={t("studio.byoDelete")} className="text-muted-foreground hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-card/30 p-4">
          <Field label={t("studio.byoLabel")}><input value={form.label} onChange={setF("label")} className={inputCls} /></Field>
          <Field label={t("studio.byoKind")}>
            <select value={form.kind} onChange={setF("kind")} className={inputCls}>
              <option value="mcp">{t("studio.byoKindMcp")}</option>
              <option value="http">{t("studio.byoKindHttp")}</option>
            </select>
          </Field>
          <Field label={t("studio.byoEndpoint")}><input value={form.endpoint} onChange={setF("endpoint")} placeholder="https://tools.example.com/mcp" className={inputCls} /></Field>
          <Field label={t("studio.byoToken")}><input type="password" value={form.token} onChange={setF("token")} className={inputCls} /></Field>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={test}
              disabled={testing || !form.endpoint}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition hover:border-cyan-electric/40 disabled:opacity-50"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
              {testing ? t("studio.byoTesting") : t("studio.byoTest")}
            </button>
            <Button onClick={add} disabled={adding || !form.label || !form.endpoint}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {adding ? t("studio.byoAdding") : t("studio.byoAdd")}
            </Button>
          </div>
          {testResult &&
            (testResult.ok ? (
              <p className="text-xs text-cyan-electric">
                {t("studio.byoTestOk")}
                {testResult.tools && testResult.tools.length > 0 && ` — ${t("studio.byoDiscovered")} ${testResult.tools.map((x) => x.name).join(", ")}`}
              </p>
            ) : (
              <p className="text-xs text-red-400">{t("studio.byoTestFail")}{testResult.error ? ` (${testResult.error})` : ""}</p>
            ))}
          {err && <p className="text-xs text-amber-500">{err}</p>}
        </div>
      </div>
    </Shell>
  );
}

function AutonomySection({ intake, update, regulated, t }: SectionProps & { regulated: boolean }) {
  const mode = intake.autonomy?.mode ?? "draft";
  const set = (m: "draft" | "auto-inbound") => update((prev) => ({ ...prev, autonomy: { ...prev.autonomy, mode: m } }));
  return (
    <Shell title={t("studio.autoTitle")} hint={t("studio.autoHint")}>
      <div className="grid gap-2.5">
        {(["draft", "auto-inbound"] as const).map((m) => {
          const active = mode === m || (regulated && m === "draft");
          const disabled = regulated && m === "auto-inbound";
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => set(m)}
              className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-cyan-electric bg-cyan-electric/10" : "border-border bg-card/40 hover:border-cyan-electric/40"}`}
            >
              <div className="font-medium">{t(m === "draft" ? "studio.autoDraft" : "studio.autoInbound")}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t(m === "draft" ? "studio.autoDraftDesc" : "studio.autoInboundDesc")}</p>
            </button>
          );
        })}
      </div>
      {regulated && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500">{t("studio.regulatedNote")}</p>}
      <div className="mt-4">
        <Field label={t("studio.cadence")}>
          <select
            value={intake.autonomy?.cadence ?? "manual"}
            onChange={(e) => update((prev) => ({ ...prev, autonomy: { ...prev.autonomy, cadence: e.target.value as Schedule } }))}
            className={inputCls}
          >
            <option value="manual">manual</option>
            <option value="daily">daily</option>
            <option value="hourly">hourly</option>
            <option value="off">off</option>
          </select>
        </Field>
      </div>
    </Shell>
  );
}

function ConstraintsSection({ intake, update, regulated, t }: SectionProps & { regulated: boolean }) {
  const c = intake.constraints ?? {};
  const set = (k: "neverDo" | "escalateWhen" | "allowedDomains") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    update((prev) => ({ ...prev, constraints: { ...prev.constraints, [k]: e.target.value } }));
  return (
    <Shell title={t("studio.conTitle")} hint={t("studio.conHint")}>
      <div className="grid gap-4">
        <Field label={t("studio.fNeverDo")}><textarea value={c.neverDo ?? ""} onChange={set("neverDo")} rows={3} className={inputCls} /></Field>
        <Field label={t("studio.fEscalate")}><textarea value={c.escalateWhen ?? ""} onChange={set("escalateWhen")} rows={2} className={inputCls} /></Field>
        <Field label={t("studio.fDomains")}><input value={c.allowedDomains ?? ""} onChange={set("allowedDomains")} placeholder="acme.com, client.org" className={inputCls} /></Field>
      </div>
      {regulated && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500">{t("studio.regulatedNote")}</p>}
    </Shell>
  );
}

function AdvancedSection({ intake, update, t }: SectionProps) {
  const c = intake.constraints ?? {};
  return (
    <Shell title={t("studio.advTitle")} hint={t("studio.advHint")}>
      <div className="grid gap-4">
        <Field label={t("studio.fCap")}>
          <input
            type="number"
            min={0}
            value={c.dailySpendCap ?? ""}
            onChange={(e) => update((prev) => ({ ...prev, constraints: { ...prev.constraints, dailySpendCap: e.target.value === "" ? null : Number(e.target.value) } }))}
            className={inputCls}
          />
        </Field>
        <Field label={t("studio.fThreshold")}>
          <input
            type="number"
            min={0}
            value={c.approvalThreshold ?? ""}
            onChange={(e) => update((prev) => ({ ...prev, constraints: { ...prev.constraints, approvalThreshold: e.target.value === "" ? null : Number(e.target.value) } }))}
            className={inputCls}
          />
        </Field>
        <Field label={t("studio.fNotes")}>
          <textarea
            value={intake.advanced?.notes ?? ""}
            onChange={(e) => update((prev) => ({ ...prev, advanced: { ...prev.advanced, notes: e.target.value } }))}
            rows={3}
            className={inputCls}
          />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("studio.capExplain")}</p>
    </Shell>
  );
}

function ReviewSection({ intake, update, plan, t }: SectionProps & { plan: Plan }) {
  // Pure, client-side preview — recomputes as the owner edits.
  const configPlan = useMemo(() => planFromIntake(intake, { plan }), [intake, plan]);
  const enabled = configPlan.agents.filter((a) => a.enabled);
  const p = configPlan.policy;
  const toggleAgent = (key: AgentKey) =>
    update((prev) => {
      const cur = new Set(prev.goals?.agents ?? []);
      if (cur.has(key)) cur.delete(key);
      else cur.add(key);
      return { ...prev, goals: { ...prev.goals, agents: Array.from(cur) } };
    });
  return (
    <Shell title={t("studio.reviewTitle")} hint={t("studio.reviewHint")}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("studio.rAgents")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {configPlan.agents.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => toggleAgent(a.key)}
                className={`flex items-center justify-between rounded-xl border p-2.5 text-left text-sm transition ${a.enabled ? "border-cyan-electric/50 bg-cyan-electric/5" : "border-border bg-card/30 text-muted-foreground"}`}
              >
                <span>{AGENTS.find((x) => x.key === a.key)?.name ?? a.key}</span>
                <span className="text-xs">
                  {a.enabled ? (a.autoSend ? t("studio.autoOn") : t("studio.approveFirst")) : t("studio.disabled")}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card/30 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("studio.rAutonomy")}</p>
            <p>{enabled.some((a) => a.autoSend) ? t("studio.autoInbound") : t("studio.autoDraft")}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/30 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("studio.rPolicy")}</p>
            <p className="text-muted-foreground">
              {p.requireApprovalOver != null ? `> $${p.requireApprovalOver} → approval` : t("studio.rNoPolicy")}
              {p.dailySpendCap != null ? ` · $${p.dailySpendCap}/day cap` : ""}
              {p.allowedDomains ? ` · ${p.allowedDomains}` : ""}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/30 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("studio.rGuardrails")}</p>
          <p className="whitespace-pre-line text-muted-foreground">{configPlan.profile.guardrails || t("studio.rNoGuardrails")}</p>
        </div>

        <ul className="space-y-1 text-xs text-muted-foreground">
          {configPlan.rationale.map((r, i) => (
            <li key={i} className="flex gap-1.5">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-cyan-electric" /> {r}
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

// ── Voice "talk it through" panel ────────────────────────────────────────────

function VoicePanel({
  locale,
  onComplete,
  t,
}: {
  locale: string;
  onComplete: (intake: Partial<StudioIntake>) => void;
  t: (k: string) => string;
}) {
  const speechLang = { es: "es-ES", fr: "fr-FR", pt: "pt-BR", de: "de-DE" }[locale] ?? "en-US";
  const { supported, listening, transcript, start, stop, reset } = useSpeechRecognition(speechLang);
  const [messages, setMessages] = useState<VoiceMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState<string>(t("studio.voiceIntro"));
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (listening) setDraft(transcript);
  }, [transcript, listening]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;
      const next = [...messages, { role: "user" as const, content: clean }];
      setMessages(next);
      setDraft("");
      reset();
      setBusy(true);
      try {
        const res = await fetch("/api/portal/studio/interview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: next, locale }),
        });
        const data = await res.json();
        if (data.fallback) {
          setUnavailable(true);
          return;
        }
        if (data.done && data.intake) {
          onComplete(data.intake as Partial<StudioIntake>);
          return;
        }
        if (data.question) {
          setQuestion(data.question);
          setMessages((m) => [...m, { role: "assistant", content: data.question }]);
        }
      } catch {
        setUnavailable(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, reset, locale, onComplete]
  );

  if (unavailable) {
    return (
      <div className="rounded-3xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
        {t("studio.voiceUnavailable")}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card/40 p-6">
      <div className="mb-4 max-h-[40vh] space-y-3 overflow-y-auto" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === "user" ? "text-foreground" : "text-cyan-electric"}`}>
            {m.content}
          </div>
        ))}
        {busy ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> …
          </div>
        ) : (
          <div className="text-sm font-medium text-cyan-electric">{question}</div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          rows={2}
          placeholder={t("studio.voiceHint")}
          className={inputCls}
        />
        {supported && (
          <button
            type="button"
            onClick={() => (listening ? stop() : start())}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition ${listening ? "border-cyan-electric bg-cyan-electric/15 text-cyan-electric" : "border-border text-muted-foreground hover:text-foreground"}`}
            aria-label={listening ? t("studio.voiceStop") : t("studio.voiceStart")}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => send(draft)}
          disabled={busy || !draft.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-electric text-background disabled:opacity-40"
          aria-label={t("studio.send")}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Merge a partial intake (from the voice interview) over the current answers,
// deep-merging the known section objects so nothing already entered is lost.
function mergeIntake(prev: StudioIntake, partial: Partial<StudioIntake>): StudioIntake {
  return {
    ...prev,
    ...partial,
    version: 1,
    context: { ...prev.context, ...partial.context },
    goals: {
      ...prev.goals,
      ...partial.goals,
      agents: Array.from(new Set([...(prev.goals?.agents ?? []), ...(partial.goals?.agents ?? [])])),
    },
    autonomy: { ...prev.autonomy, ...partial.autonomy },
    constraints: { ...prev.constraints, ...partial.constraints },
    advanced: { ...prev.advanced, ...partial.advanced },
  };
}
