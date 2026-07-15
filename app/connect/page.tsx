import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, Check, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import type { InboxPreview } from "@/lib/inbox-preview";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("msc.connectMetaTitle"),
    description: t("msc.connectMetaDescription"),
    alternates: { canonical: "/connect" },
  };
}

const CONFIGURED = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const SAMPLE: InboxPreview = {
  total: 9,
  autoDraft: 5,
  triage: 3,
  estMinutesSaved: 36,
  examples: [
    { subject: "Re: Catering for 40 people on the 22nd?", action: "Auto-draft reply" },
    { subject: "Question about your availability next week", action: "Auto-draft reply" },
    { subject: "Invoice #4821 from Sysco", action: "File + log" },
    { subject: "Your weekly restaurant marketing digest", action: "Archive" },
    { subject: "Table for 6 this Friday — possible?", action: "Auto-draft reply" },
    { subject: "Vendor: updated delivery schedule", action: "Triage + label" },
  ],
};

const actionColor: Record<string, string> = {
  "Auto-draft reply": "bg-cyan-electric/10 text-cyan-electric border-cyan-electric/25",
  "Triage + label": "bg-indigo-400/10 text-indigo-300 border-indigo-400/25",
  Archive: "bg-white/5 text-muted-foreground border-border",
  "File + log": "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
};

export default async function ConnectPage() {
  const store = await cookies();
  const raw = store.get("ff_inbox_preview")?.value;
  let live: InboxPreview | null = null;
  if (raw) {
    try {
      live = JSON.parse(raw) as InboxPreview;
    } catch {
      live = null;
    }
  }
  const preview = live ?? SAMPLE;
  const isLive = !!live;

  const { t } = await getT();

  return (
    <PageLayout>
      <section className="relative overflow-hidden pb-10 pt-4">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark" />
        <div className="container relative">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1 text-xs font-medium text-cyan-electric">
              <Sparkles className="h-3 w-3" /> {t("msc.connectBadge")}
            </span>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {isLive ? t("msc.connectH1LiveA") : t("msc.connectH1A")}{" "}
              <span className="gradient-text">
                {isLive ? t("msc.connectH1LiveB") : t("msc.connectH1B")}
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              {isLive ? t("msc.connectSubLive") : t("msc.connectSub")}
            </p>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container">
          <div className="mx-auto max-w-3xl">
            <div className="gradient-border glass-strong overflow-hidden rounded-3xl">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-cyan-electric" />
                  <span className="font-medium">{isLive ? t("msc.connectYourInbox") : t("msc.connectSampleInbox")}</span>
                  {!isLive && (
                    <span className="rounded-full border border-border bg-card/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                      {t("msc.connectPreview")}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  ~<span className="font-medium text-cyan-electric">{preview.estMinutesSaved} {t("msc.connectMinAbbrev")}</span> {t("msc.connectSaved")}
                </span>
              </div>

              <div className="grid gap-3 p-6 sm:grid-cols-3">
                <Stat label={t("msc.connectStatScanned")} value={preview.total} />
                <Stat label={t("msc.connectStatDrafted")} value={preview.autoDraft} accent />
                <Stat label={t("msc.connectStatTriaged")} value={preview.triage} />
              </div>

              <ul className="divide-y divide-border/50 px-2 pb-2">
                {preview.examples.map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate text-sm">{e.subject}</span>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        actionColor[e.action] ?? actionColor["Triage + label"]
                      }`}
                    >
                      {e.action}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action row */}
            <div className="mt-6 flex flex-col items-center gap-3">
              {isLive ? (
                <Link href="/build">
                  <Button size="lg">
                    {t("msc.connectBuildReal")} <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : CONFIGURED ? (
                <a href="/api/connect/google/start">
                  <Button size="lg">
                    <Mail className="h-4 w-4" /> {t("msc.connectGmailBtn")}
                  </Button>
                </a>
              ) : (
                <div className="text-center">
                  <Button size="lg" disabled>
                    <Lock className="h-4 w-4" /> {t("msc.connectComingSoon")}
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("msc.connectSampleNote")}
                  </p>
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> {t("msc.connectReadOnly")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-300" /> {t("msc.connectNothingStored")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-300" /> {t("msc.connectRevoke")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 text-center ${accent ? "border-cyan-electric/40 bg-cyan-electric/10" : "border-border bg-card/40"}`}>
      <p className={`font-display text-3xl font-semibold tabular-nums ${accent ? "gradient-text" : ""}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
