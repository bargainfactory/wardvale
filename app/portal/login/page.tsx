"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Loader2, Lock, Mail } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase";
import { safeInternalPath } from "@/lib/paths";
import { useLocale } from "@/lib/locale-context";

const CONFIGURED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function LoginCard() {
  const { t } = useLocale();
  const params = useSearchParams();
  // Deep links (welcome email → /portal/studio) survive the magic-link round
  // trip: forward `next` into the callback; /auth/confirm sanitizes it again.
  const next = safeInternalPath(params.get("next"));
  const linkError = params.get("error");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!CONFIGURED) {
      setError(t("prt.loginNotConfigured"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
          // Deliberately open: any email may sign in — the first portal visit
          // provisions a live trial (self-serve funnel), so there is no
          // invite list to check against.
          shouldCreateUser: true,
        },
      });
      if (error) setError(error.message);
      else setSent(true);
    } catch {
      setError(t("prt.loginError"));
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    await send();
  }

  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-3xl gradient-border glass-strong p-8">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric/25 to-indigo-500/15 text-cyan-electric">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">{t("prt.loginTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("prt.loginSub")}
        </p>

        {linkError && !sent && (
          <div className="mt-6 flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{linkError === "expired" ? t("prt.loginErrExpired") : t("prt.loginErrFailed")}</span>
          </div>
        )}

        {sent ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("prt.loginSentPre")}<b>{email}</b>{t("prt.loginSentPost")}</span>
            </div>
            {/* Resend commonly hits Supabase's 60s OTP cooldown — surface it,
                or the green banner keeps promising an email that never comes. */}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" size="sm" onClick={send} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {t("prt.loginAnother")}
              </Button>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-xs text-muted-foreground underline-offset-4 hover:text-cyan-electric hover:underline"
              >
                {t("prt.loginChangeEmail")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3 focus-within:border-cyan-electric/50">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                className="w-full bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {t("prt.sendMagicLink")}
            </Button>
          </form>
        )}

        <Link href="/portal" className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-electric">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("prt.backToDemo")}
        </Link>
      </div>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <PageLayout>
      <Suspense fallback={<div className="container min-h-[60vh] py-16" />}>
        <LoginCard />
      </Suspense>
    </PageLayout>
  );
}
