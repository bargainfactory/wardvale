import { NextResponse } from "next/server";
import { getPortalUserEmail } from "@/lib/supabase-ssr";
import { callModel, modelConfigured } from "@/lib/model";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { fenceUntrusted, SECURITY_PREAMBLE } from "@/lib/guardrails";
import { overBudget, recordTokens, DAILY_TOKEN_CAP } from "@/lib/usage";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/**
 * "Talk it through" — the conversational front-end to the Agent Design Studio.
 * A portal-authed owner answers the same 7-section questionnaire by voice/chat;
 * the model accumulates a structured StudioIntake (the SAME object the form
 * produces), so both paths converge on one review card → one apply. This route
 * only ASSEMBLES answers; it never writes config (that's /api/portal/studio apply).
 */

type Msg = { role: "user" | "assistant"; content: string };

const STUDIO_SYSTEM = `You are Wardvale's Agent Design guide. You interview a business owner who has ALREADY signed up, to configure their AI agents. Ask ONE short, friendly question per turn (under 25 words, with a concrete example in parentheses), covering these themes in order — skip any that clearly don't apply, and never re-ask something already answered:
1. CONTEXT — industry, what they offer, hours, pricing they'd quote, common questions & answers, and the tone their agents should write in.
2. GOALS — which outcomes matter most. Map each to one of these agent keys: inbox-triage (email replies), support-triage (support tickets), lead-qualification (new leads), review-request (asking for reviews), cart-recovery (abandoned carts), ar-followup (overdue invoices), winback (lapsed customers), quote-followup (open quotes/estimates), hiring-assist (job applicants), referral-ask (referral requests), noshow-shield (appointment confirmations/backfill), review-response (replying to reviews), shift-cover (staff call-outs), content-drafter (posts/newsletters), doc-chaser (missing client documents), dispute-fighter (chargebacks/fee disputes).
3. AUTONOMY — should agents draft everything for their approval (default), or auto-send low-risk inbound replies? Wardvale is approval-first; only pick auto for inbound replies if they clearly ask.
4. CONSTRAINTS — anything the agents must NEVER do, when to escalate to a human, and which email domains are allowed for any auto-send.

Keep it to about 6-9 questions. When you have enough, set done=true.

OUTPUT — respond with ONLY valid JSON:
{ "done": boolean, "progress": number (0-100), "question"?: string,
  "intake"?: {
    "version": 1,
    "context"?: { "industry"?: string, "hours"?: string, "services"?: string, "pricing"?: string, "faq"?: string, "tone"?: string },
    "goals"?: { "agents"?: string[], "successMetric"?: string },
    "autonomy"?: { "mode"?: "draft" | "auto-inbound" },
    "constraints"?: { "neverDo"?: string, "escalateWhen"?: string, "allowedDomains"?: string }
  } }
Rules: "goals.agents" MUST contain only the agent keys listed above. Use "autonomy.mode":"draft" unless they explicitly asked to auto-send inbound replies. While done=false include "question" and omit "intake". While done=true include the assembled "intake" and omit "question". Build "intake" cumulatively from the WHOLE conversation, not just the last answer.`;

export async function POST(req: Request) {
  const email = await getPortalUserEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ip = clientIp(req);
  const rl = await rateLimit(`studio-interview:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { done: false, progress: 0, question: "One moment — try again in a few seconds." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const messages: Msg[] = Array.isArray(body.messages) ? body.messages : [];

    // No model / over budget → tell them to use the form (graceful, honest).
    if (!modelConfigured("workflow") || overBudget(`ai:${ip}`, DAILY_TOKEN_CAP)) {
      return NextResponse.json({
        done: false,
        progress: 0,
        question: "Voice setup isn't available right now — you can fill in the form below instead.",
        fallback: true,
      });
    }

    const answered = messages.filter((m) => m.role === "user").length;
    const nudge = answered >= 8 ? "\n\nYou have plenty of detail — set done=true and return the intake." : "";

    const apiMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: `${SECURITY_PREAMBLE}\n\n${STUDIO_SYSTEM}${nudge}` },
      ...messages.map((m) => ({
        role: m.role,
        // Owner answers are data — fence the latest free-text before it reaches the model.
        content: m.role === "user" ? fenceUntrusted(m.content) : m.content,
      })) as ChatCompletionMessageParam[],
    ];

    let completion;
    try {
      completion = await callModel({
        purpose: "workflow",
        max_tokens: 700,
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: apiMessages,
      });
    } catch {
      return NextResponse.json({
        done: false,
        progress: 0,
        question: "Voice setup hit a snag — please use the form below.",
        fallback: true,
      });
    }

    recordTokens(`ai:${ip}`, completion.usage?.total_tokens ?? 0);
    const parsed = parseJson(completion.choices[0]?.message?.content ?? "");
    if (!parsed) {
      return NextResponse.json({ done: false, progress: 0, question: "Sorry — could you say that another way?" });
    }
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ done: false, progress: 0, question: "Sorry — I hit a snag. Try again?" });
  }
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
