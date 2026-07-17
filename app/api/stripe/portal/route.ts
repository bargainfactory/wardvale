import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/report";

/**
 * Open the signed-in client's Stripe Billing Portal — update payment, switch
 * plans, PAUSE, or cancel. This is the correct home for cancellation + the
 * retention "save flow": configure pause offers, discounts, and cancellation
 * reasons in the Stripe Dashboard → Billing → Customer portal, and Stripe runs
 * the save flow natively before a cancel goes through.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`billing:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }

  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = getServiceClient();
  if (!svc || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const { data: client } = await svc
    .from("clients")
    .select("stripe_customer_id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  const customer = (client as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
  if (!customer) return NextResponse.json({ error: "no_subscription" }, { status: 400 });

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    reportError(err, { source: "stripe.billing-portal" });
    return NextResponse.json({ error: "billing_unavailable" }, { status: 500 });
  }
}
