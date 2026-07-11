import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

const priceMap: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  scale: process.env.STRIPE_PRICE_SCALE,
};

export async function POST(req: Request) {
  try {
    const { tier } = (await req.json()) as { tier: string };
    const priceId = priceMap[tier];

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
      metadata: { tier },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
