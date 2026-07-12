import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/supabase-server";
import { firstTime, idemKey } from "@/lib/idempotency";

// Event-driven triggers: instead of waiting for the hourly scheduler, Shopify
// pushes events here and we run the relevant agent immediately — abandoned
// checkout → cart recovery, new paid order → review request. Real-time beats
// polling. Register these in the Shopify admin (checkouts/create, orders/create)
// pointed at NEXT_PUBLIC_SITE_URL/api/webhooks/shopify.

function hmacValid(raw: string, header: string, secret: string): boolean {
  const digest = createHmac("sha256", secret).update(raw, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

const fullName = (c?: { first_name?: string; last_name?: string }) =>
  [c?.first_name, c?.last_name].filter(Boolean).join(" ");

type ShopifyLineItem = { title?: string };
type ShopifyPayload = {
  id?: number;
  email?: string;
  phone?: string;
  total_price?: string;
  abandoned_checkout_url?: string;
  customer?: { first_name?: string; last_name?: string; phone?: string };
  line_items?: ShopifyLineItem[];
};

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? process.env.SHOPIFY_CLIENT_SECRET;
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  if (secret && (!hmac || !hmacValid(raw, hmac, secret))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shop = req.headers.get("x-shopify-shop-domain") ?? "";
  const webhookId = req.headers.get("x-shopify-webhook-id") ?? "";
  if (!shop) return NextResponse.json({ received: true });

  // Idempotency — Shopify retries; don't run the agent twice for one event.
  if (!firstTime(idemKey("shopify", webhookId || `${shop}:${topic}`), 10 * 60_000)) {
    return NextResponse.json({ received: true, deduped: true });
  }

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ received: true });

  // Resolve the client that owns this shop, and their ingest key.
  const { data: conn } = await supabase
    .from("connections")
    .select("client_id")
    .eq("provider", "Shopify")
    .eq("external_id", shop)
    .eq("status", "connected")
    .maybeSingle();
  if (!conn) return NextResponse.json({ received: true });
  const { data: client } = await supabase.from("clients").select("ingest_key, status").eq("id", conn.client_id).maybeSingle();
  if (!client?.ingest_key || client.status !== "active") return NextResponse.json({ received: true });

  const payload = JSON.parse(raw || "{}") as ShopifyPayload;
  let agent: string | null = null;
  let bodyExtra: Record<string, unknown> = {};

  if (topic.startsWith("checkouts/")) {
    agent = "cart-recovery";
    bodyExtra = {
      carts: [
        {
          customer: fullName(payload.customer) || payload.email || "",
          email: payload.email ?? "",
          phone: payload.phone ?? payload.customer?.phone ?? "",
          total: Number(payload.total_price) || 0,
          url: payload.abandoned_checkout_url ?? "",
          items: (payload.line_items ?? []).map((li) => li.title).filter(Boolean).slice(0, 5).join(", "),
        },
      ],
    };
  } else if (topic.startsWith("orders/")) {
    agent = "review-request";
    bodyExtra = {
      targets: [
        {
          customer: fullName(payload.customer) || payload.email || "",
          email: payload.email ?? "",
          phone: payload.phone ?? payload.customer?.phone ?? "",
          service: (payload.line_items ?? []).map((li) => li.title).filter(Boolean).slice(0, 3).join(", "),
        },
      ],
    };
  }
  if (!agent) return NextResponse.json({ received: true, ignored: topic });

  // Run the agent immediately through the same pipeline (context, learning,
  // policy, auto-send/approval, outcomes, notifications).
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  try {
    await fetch(`${origin}/api/agents/run`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${client.ingest_key}` },
      body: JSON.stringify({ agent, ...bodyExtra }),
      cache: "no-store",
    });
  } catch {
    /* Shopify will retry on a non-2xx; we still 200 to avoid dupes since the
       idempotency guard already fired. */
  }

  return NextResponse.json({ received: true, ran: agent });
}
