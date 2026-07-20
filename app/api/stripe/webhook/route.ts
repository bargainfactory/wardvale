import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getServiceClient } from "@/lib/supabase-server";
import { provisionClient } from "@/lib/provisioning";
import { planFromTier } from "@/lib/agents-catalog";
import { sendWelcome } from "@/lib/email";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ received: false }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = typeof session.customer === "string" ? session.customer : null;
        const email = session.customer_details?.email ?? session.customer_email ?? null;
        const tier = session.metadata?.tier ?? null;
        await upsertSubscriber({ customerId, email, tier, status: "active", sessionId: session.id });
        // Turnkey: a paid checkout provisions a live client (plan from the tier),
        // active immediately, with agents + profile seeded.
        if (email) {
          // Detect first-time provisioning so we welcome each client only once
          // (Stripe may retry; a plan change re-fires this event too).
          const svc = getServiceClient();
          const existing = svc
            ? (await svc.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle()).data
            : null;
          await provisionClient({
            email,
            plan: planFromTier(tier),
            status: "active",
            stripeCustomerId: customerId,
          });
          if (!existing) await sendWelcome({ to: email });
        }
        console.log("New subscription provisioned:", session.id);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await updateStatusByCustomer(sub.customer, "canceled");
        await suspendClientByCustomer(sub.customer, "canceled");
        console.log("Subscription cancelled:", sub.id);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await updateStatusByCustomer(invoice.customer, "past_due");
        await suspendClientByCustomer(invoice.customer, "past_due");
        console.log("Payment failed:", invoice.id);
        break;
      }
    }
  } catch (err) {
    // Never 500 back to Stripe for a persistence hiccup — that triggers
    // endless retries. Log and acknowledge; reconcile out of band.
    console.error("Webhook side-effect failed:", err);
  }

  return NextResponse.json({ received: true });
}

async function upsertSubscriber(input: {
  customerId: string | null;
  email: string | null;
  tier: string | null;
  status: string;
  sessionId: string;
}) {
  const supabase = getServiceClient();
  if (!supabase) return;
  const { error } = await supabase.from("subscribers").upsert(
    {
      stripe_customer_id: input.customerId,
      email: input.email?.toLowerCase() ?? null,
      tier: input.tier,
      status: input.status,
      last_session_id: input.sessionId,
    },
    { onConflict: "stripe_customer_id" }
  );
  if (error) console.error("upsertSubscriber error:", error.message);
}

async function updateStatusByCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
  status: string
) {
  const supabase = getServiceClient();
  if (!supabase) return;
  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (!customerId) return;
  const { error } = await supabase
    .from("subscribers")
    .update({ status })
    .eq("stripe_customer_id", customerId);
  if (error) console.error("updateStatusByCustomer error:", error.message);
}

// Mirror the lifecycle onto the client so the scheduler stops running agents for
// a canceled/past-due account until they're back in good standing.
async function suspendClientByCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
  status: string
) {
  const supabase = getServiceClient();
  if (!supabase) return;
  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (!customerId) return;
  const { error } = await supabase.from("clients").update({ status }).eq("stripe_customer_id", customerId);
  if (error) console.error("suspendClientByCustomer error:", error.message);
}
