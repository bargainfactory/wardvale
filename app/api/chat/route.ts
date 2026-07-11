import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const SYSTEM_PROMPT = `You are the FlowForge AI website assistant. Be concise, helpful, and friendly. You sell premium AI-powered automation (Zapier flows + custom GPT agents) to small businesses on monthly retainers ($500–$3,000/mo).

Key info:
- Services: lead capture, onboarding autopilot, inbox triage, custom agents
- Verticals: restaurants, e-com, consulting, local services
- 14-day build guarantee, month-to-month after 30-day onboarding
- Stack: Zapier, Make, HubSpot, Shopify, Stripe, Gmail, Calendly, Notion, Slack, OpenAI
- Runs on your own infrastructure — we never store customer PII; GDPR-ready, DPA on request
- 21-day ROI guarantee: break even in 21 days or we keep optimizing free until you do
- Direct to the quote form or Calendly if they seem interested.

Keep answers under 3 sentences unless asked for detail.`;

export async function POST(req: Request) {
  const rl = await rateLimit(`chat:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { reply: "You're sending messages a little fast — give it a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const messages = body.messages as { role: "user" | "assistant"; content: string }[];

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        reply:
          "I'm currently in demo mode! In production I'd be powered by GPT-4o and can answer anything about FlowForge services, pricing, and integrations. Try the instant quote form below!",
      });
    }

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 250,
      temperature: 0.7,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.slice(-8),
      ],
    });

    return NextResponse.json({
      reply: completion.choices[0]?.message?.content ?? "Sorry, try again.",
    });
  } catch {
    return NextResponse.json({
      reply: "I'm having trouble connecting right now. Please try the quote form below or email hello@flowforge.ai.",
    });
  }
}
