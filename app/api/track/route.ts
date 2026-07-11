import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * First-party analytics ingest. Stores events in Supabase (`events` table) and
 * optionally forwards to PostHog when POSTHOG_KEY is set. No third-party
 * scripts, no cookies leave the origin — privacy-first by default. No-ops
 * gracefully when nothing is configured.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`track:${clientIp(req)}`, 240, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  try {
    const body = (await req.json()) as {
      name?: string;
      props?: Record<string, unknown>;
      sessionId?: string;
      variant?: string;
      path?: string;
    };
    if (!body?.name || typeof body.name !== "string") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const name = body.name.slice(0, 80);
    const props = body.props && typeof body.props === "object" ? body.props : {};

    const supabase = getServiceClient();
    if (supabase) {
      await supabase.from("events").insert({
        name,
        props,
        session_id: body.sessionId ?? null,
        variant: body.variant ?? null,
        path: body.path ?? null,
      });
    }

    const posthogKey = process.env.POSTHOG_KEY;
    if (posthogKey) {
      const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";
      await fetch(`${host}/capture/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: posthogKey,
          event: name,
          distinct_id: body.sessionId ?? "anonymous",
          properties: { ...props, variant: body.variant, $current_url: body.path },
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch {
    // Analytics must never surface errors to the client.
    return NextResponse.json({ ok: true });
  }
}
