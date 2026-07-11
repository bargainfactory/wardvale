import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, Check, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import type { InboxPreview } from "@/lib/inbox-preview";

export const metadata: Metadata = {
  title: "See It On Your Data — Connect Your Inbox",
  description:
    "Connect Gmail read-only and watch FlowForge preview a real inbox automation on your actual emails — what we'd auto-draft, triage, and archive. Nothing is stored.",
  alternates: { canonical: "/connect" },
};

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

  return (
    <PageLayout>
      <section className="relative overflow-hidden pb-10 pt-4">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark" />
        <div className="container relative">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1 text-xs font-medium text-cyan-electric">
              <Sparkles className="h-3 w-3" /> See it on your data
            </span>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {isLive ? "Here's your inbox, " : "Watch it work on "}
              <span className="gradient-text">{isLive ? "automated." : "your real inbox."}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              {isLive
                ? "Below is exactly what an Inbox Triage agent would do with your last few emails."
                : "Connect Gmail read-only and we'll preview what our Inbox Triage agent would do with your actual emails — no imagination required."}
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
                  <span className="font-medium">{isLive ? "Your inbox" : "Sample inbox"}</span>
                  {!isLive && (
                    <span className="rounded-full border border-border bg-card/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                      preview
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  ~<span className="font-medium text-cyan-electric">{preview.estMinutesSaved} min</span> saved
                </span>
              </div>

              <div className="grid gap-3 p-6 sm:grid-cols-3">
                <Stat label="Emails scanned" value={preview.total} />
                <Stat label="Auto-drafted" value={preview.autoDraft} accent />
                <Stat label="Triaged" value={preview.triage} />
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
                    Build this for real <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : CONFIGURED ? (
                <a href="/api/connect/google/start">
                  <Button size="lg">
                    <Mail className="h-4 w-4" /> Connect Gmail (read-only)
                  </Button>
                </a>
              ) : (
                <div className="text-center">
                  <Button size="lg" disabled>
                    <Lock className="h-4 w-4" /> Live connect coming soon
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    This is a sample. Live inbox connect activates once Google OAuth is configured.
                  </p>
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Read-only access
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-300" /> Nothing stored
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-300" /> Revoke anytime in your Google account
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
