import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/report";

// Resolve the Stripe price for a tier + billing cycle. Annual prices live in
// STRIPE_PRICE_<TIER>_ANNUAL; monthly in STRIPE_PRICE_<TIER>. The Growth A/B test
// keeps its own (variant B) price so we never charge less than displayed.
function priceFor(tier: string, cycle: "monthly" | "annual", variant?: string): string | undefined {
  const suffix = cycle === "annual" ? "_ANNUAL" : "";
  const base = tier === "growth" && variant === "B" ? "GROWTH_B" : tier.toUpperCase();
  return process.env[`STRIPE_PRICE_${base}${suffix}`];
}

export async function POST(req: Request) {
  // Throttle: a checkout session hits Stripe, so cap per-IP to stop spam.
  const rl = await rateLimit(`checkout:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts — please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const { tier, variant, cycle } = (await req.json()) as { tier: string; variant?: string; cycle?: string };
    const billingCycle: "monthly" | "annual" = cycle === "annual" ? "annual" : "monthly";
    const priceId = priceFor(tier, billingCycle, variant);

    if (!priceId || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Checkout is not configured yet. Contact hello@flowforge.ai." },
        { status: 503 }
      );
    }

    const session = await getStripe().checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/#pricing`,
        allow_promotion_codes: true,
        billing_address_collection: "required",
        metadata: { tier, cycle: billingCycle, ...(tier === "growth" && variant ? { growth_variant: variant } : {}) },
      },
      {
        // Provider-level idempotency: dedupe accidental double-clicks in a minute.
        idempotencyKey: `co_${tier}_${billingCycle}_${variant ?? "A"}_${Math.floor(Date.now() / 60000)}`,
      }
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Log the real error server-side; return a generic message (don't leak Stripe internals).
    reportError(err, { source: "stripe.checkout" });
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
