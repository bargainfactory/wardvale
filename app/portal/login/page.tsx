"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Lock, Mail } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase";

const CONFIGURED = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export default function PortalLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!CONFIGURED) {
      setError("Client sign-in isn't switched on yet. Contact hello@flowforge.ai for access.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/portal` },
      });
      if (error) setError(error.message);
      else setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageLayout>
      <div className="container flex min-h-[60vh] items-center justify-center py-16">
        <div className="w-full max-w-md rounded-3xl gradient-border glass-strong p-8">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric/25 to-indigo-500/15 text-cyan-electric">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold">Client portal sign-in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the email on your FlowForge account and we&rsquo;ll send a magic link — no password needed.
          </p>

          {sent ? (
            <div className="mt-6 flex items-start gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Check your inbox — we sent a secure sign-in link to <b>{email}</b>.</span>
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
                Send magic link
              </Button>
            </form>
          )}

          <Link href="/portal" className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-electric">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to the demo dashboard
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
