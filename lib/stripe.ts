import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Lazily construct the Stripe client.
 *
 * The client is only instantiated on first use inside a request handler —
 * never at module load — so an unconfigured environment (e.g. CI build,
 * preview deploy without secrets) does not throw during Next's build-time
 * page-data collection. Callers must gate on STRIPE_SECRET_KEY first.
 */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return _stripe;
}
