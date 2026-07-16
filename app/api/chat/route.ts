import { NextResponse } from "next/server";
import { callModel, modelConfigured } from "@/lib/model";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { detectInjection, SECURITY_PREAMBLE } from "@/lib/guardrails";
import { overBudget, recordTokens, DAILY_TOKEN_CAP } from "@/lib/usage";
import { startTrace } from "@/lib/trace";

const SYSTEM_PROMPT = `${SECURITY_PREAMBLE}

You are the FlowForge AI website assistant. Be concise, helpful, and friendly. You sell premium AI-powered automation (Zapier flows + custom GPT agents) to small businesses on monthly retainers ($500–$5,000/mo, plus custom Enterprise).

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
  const ip = clientIp(req);
  const rl = await rateLimit(`chat:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { reply: "You're sending messages a little fast — give it a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const messages = (Array.isArray(body.messages) ? body.messages : []) as { role: "user" | "assistant"; content: string }[];

    const trace = startTrace("chat", typeof body?.sessionId === "string" ? body.sessionId : undefined);
    // Guardrail: refuse likely prompt-injection instead of processing it.
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    trace.setInput(lastUser);
    if (detectInjection(lastUser).flagged) {
      trace.flag("injection", true);
      trace.setStatus("refused");
      await trace.end();
      return NextResponse.json({
        reply:
          "I can only help with questions about FlowForge — our services, pricing, and integrations. What would you like to know?",
      });
    }

    if (!modelConfigured()) {
      return NextResponse.json({
        reply:
          "I'm currently in demo mode! In production I'd be powered by GPT-4o and can answer anything about FlowForge services, pricing, and integrations. Try the instant quote form below!",
      });
    }

    // Cost guardrail: bound daily inference spend per IP.
    if (overBudget(`ai:${ip}`, DAILY_TOKEN_CAP)) {
      trace.flag("overBudget", true);
      trace.setStatus("fallback");
      await trace.end();
      return NextResponse.json({
        reply: "We're at capacity for automated replies right now — please use the quote form or email hello@flowforge.ai.",
      });
    }

    trace.mark("model.start");
    const completion = await callModel({
      purpose: "chat",
      // Headroom for a reasoning model: hidden reasoning tokens count against
      // max_tokens, so 250 often returned empty content on Grok 4.5.
      max_tokens: 800,
      temperature: 0.7,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages.slice(-8)],
    });
    const tokens = completion.usage?.total_tokens ?? 0;
    recordTokens(`ai:${ip}`, tokens);
    const reply = completion.choices[0]?.message?.content ?? "Sorry, try again.";
    trace.mark("model.end", { tokens });
    trace.setTokens(tokens);
    trace.setOutput(reply);
    await trace.end();

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({
      reply: "I'm having trouble connecting right now. Please try the quote form below or email hello@flowforge.ai.",
    });
  }
}
