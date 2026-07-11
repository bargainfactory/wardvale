import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

const priceMap: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  scale: process.env.STRIPE_PRICE_SCALE,
};

export async function POST(req: Request) {
  try {
    const { tier, variant } = (await req.json()) as { tier: string; variant?: string };
    // Growth price A/B test: variant B uses a second Stripe price if configured.
    let priceId = priceMap[tier];
    if (tier === "growth" && variant === "B" && process.env.STRIPE_PRICE_GROWTH_B) {
      priceId = process.env.STRIPE_PRICE_GROWTH_B;
    }

    if (!priceId || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Checkout is not configured yet. Contact hello@flowforge.ai." },
        { status: 503 }
      );
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/#pricing`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      metadata: { tier, ...(tier === "growth" && variant ? { growth_variant: variant } : {}) },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
