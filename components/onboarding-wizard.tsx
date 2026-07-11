"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Loader2, Plug, Sparkles } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { PACKS } from "@/lib/agents-catalog";

type Form = { industry: string; hours: string; services: string; pricing: string; faq: string; tone: string };

export function OnboardingWizard({ initial }: { initial: Form }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(initial);
  const [pack, setPack] = useState<string | null>(null);
  const [savingPack, setSavingPack] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function choosePack(id: string) {
    setSavingPack(id);
    const p = PACKS.find((x) => x.id === id);
    if (p) setForm((f) => ({ ...f, industry: f.industry || p.industry, tone: p.tone }));
    try {
      await fetch("/api/portal/pack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packId: id }),
      });
      setPack(id);
    } catch {
      /* ignore */
    }
    setSavingPack(null);
  }

  async function finish() {
    setSaving(true);
    try {
      await fetch("/api/portal/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, finish: true }),
      });
      router.push("/portal");
    } catch {
      setSaving(false);
    }
  }

  return (
    <PageLayout>
      <div className="container max-w-3xl pb-16">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">Get set up</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Let&rsquo;s make your agents yours.</h1>
          <p className="mt-1 text-muted-foreground">Three quick steps — you can change everything later in the portal.</p>
        </div>

        {/* Step 1 — pack */}
        <Section n={1} title="Pick your starting pack" hint="Turns on the right agents for your industry. Optional.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PACKS.map((p) => (
              <button
                key={p.id}
                onClick={() => choosePack(p.id)}
                disabled={savingPack !== null}
                className={`rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
                  pack === p.id ? "border-cyan-electric bg-cyan-electric/10" : "border-border bg-card/40 hover:border-cyan-electric/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold">{p.name}</span>
                  {pack === p.id ? (
                    <Check className="h-4 w-4 text-cyan-electric" />
                  ) : savingPack === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.industry}</p>
                <p className="mt-2 text-xs text-muted-foreground">{p.agents.length} agents · {p.connectors.length} tools</p>
              </button>
            ))}
          </div>
        </Section>

        {/* Step 2 — profile */}
        <Section n={2} title="Tell us about your business" hint="Your agents draft using these facts — so replies are accurate and in your voice.">
          <div className="grid gap-4">
            <Field label="Industry"><input value={form.industry} onChange={set("industry")} placeholder="e.g. Italian restaurant" className={inputCls} /></Field>
            <Field label="Hours"><input value={form.hours} onChange={set("hours")} placeholder="e.g. Tue–Sun 5–10pm, closed Mondays" className={inputCls} /></Field>
            <Field label="Services / products"><textarea value={form.services} onChange={set("services")} rows={2} placeholder="What you offer — the agents reference this." className={inputCls} /></Field>
            <Field label="Pricing (optional)"><textarea value={form.pricing} onChange={set("pricing")} rows={2} placeholder="Anything agents can quote — deposits, ranges, packages." className={inputCls} /></Field>
            <Field label="Common questions & answers"><textarea value={form.faq} onChange={set("faq")} rows={4} placeholder="Q: Do you take walk-ins? A: Yes, until 9pm.  (One per line is great.)" className={inputCls} /></Field>
            <Field label="Tone"><input value={form.tone} onChange={set("tone")} placeholder="e.g. warm, concise, professional" className={inputCls} /></Field>
          </div>
        </Section>

        {/* Step 3 — connect */}
        <Section n={3} title="Connect your tools" hint="So agents can read and act — every outbound action still waits for your approval.">
          <Link
            href="/connections"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-4 py-2 text-sm transition hover:border-cyan-electric/40 hover:text-cyan-electric"
          >
            <Plug className="h-4 w-4" /> Open connections (new tab)
          </Link>
        </Section>

        <div className="mt-8 flex items-center gap-3">
          <Button size="lg" onClick={finish} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {saving ? "Saving…" : "Finish setup"}
          </Button>
          <Link href="/portal" className="text-sm text-muted-foreground hover:text-foreground">
            Skip for now
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-card/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-cyan-electric";

function Section({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-electric/15 text-sm font-semibold text-cyan-electric">{n}</span>
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
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
