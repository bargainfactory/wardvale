import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendRoiDigest } from "@/lib/email";
import { reportError } from "@/lib/report";

/**
 * Monthly ROI digest (retention). Emails each active client a recap of the REAL
 * realized impact their agents delivered in the last 30 days — dollars saved,
 * hours reclaimed, actions run — pulled from resolved `outcomes` rows.
 *
 * Hard rule: NEVER fabricate. A client with no realized outcomes this period is
 * skipped entirely; we only ever send figures backed by real data. Same
 * CRON_SECRET auth as the other crons; schedule this monthly.
 */
export const maxDuration = 60;

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const url = new URL(req.url);
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || url.searchParams.get("key") || "";
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wardvale.com";

  try {
    const { data: clients } = await svc.from("clients").select("id, email, name").eq("status", "active");
    let sent = 0;
    let skipped = 0;

    for (const c of ((clients ?? []) as { id: string; email: string | null; name: string | null }[]).slice(0, 500)) {
      if (!c.email) {
        skipped++;
        continue;
      }
      // REAL realized impact only, unioned across BOTH ledgers (last 30 days):
      // - `outcomes` (agent ledger): WON outcomes carry attributed `value`
      // - `runs` (automation ledger): ingested dollars_saved / minutes_saved
      // (Bug fix: this previously selected runs' columns FROM outcomes, which
      // don't exist there — so the digest could never send.)
      const [{ data: outRows }, { data: runRows }] = await Promise.all([
        svc.from("outcomes").select("value").eq("client_id", c.id).eq("status", "won").gte("created_at", since),
        svc.from("runs").select("dollars_saved, minutes_saved").eq("client_id", c.id).gte("created_at", since),
      ]);
      const wonValue = ((outRows ?? []) as { value: number | null }[]).reduce((s, o) => s + (Number(o.value) || 0), 0);
      const runList = (runRows ?? []) as { dollars_saved: number | null; minutes_saved: number | null }[];
      const dollarsSaved = wonValue + runList.reduce((s, r) => s + (Number(r.dollars_saved) || 0), 0);
      const minutes = runList.reduce((s, r) => s + (Number(r.minutes_saved) || 0), 0);
      const runs = (outRows?.length ?? 0) + runList.length;

      // No real impact this period → skip. Never send fabricated numbers.
      if (runs === 0 || (dollarsSaved <= 0 && minutes <= 0)) {
        skipped++;
        continue;
      }

      const ok = await sendRoiDigest({
        to: c.email,
        name: c.name ?? undefined,
        dollarsSaved,
        hoursSaved: minutes / 60,
        runs,
        periodLabel: "the last 30 days",
        portalUrl: `${siteUrl}/portal`,
      });
      if (ok) sent++;
      else skipped++;
    }

    return NextResponse.json({ ok: true, sent, skipped });
  } catch (err) {
    reportError(err, { source: "cron.roi-digest" });
    return NextResponse.json({ error: "digest_failed" }, { status: 500 });
  }
}
