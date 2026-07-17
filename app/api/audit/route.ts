import { NextResponse } from "next/server";
import { callModel, modelConfigured } from "@/lib/model";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { saveLead } from "@/lib/leads";
import { verifyTurnstile } from "@/lib/turnstile";
import { fenceUntrusted, SECURITY_PREAMBLE } from "@/lib/guardrails";

const FALLBACK = {
  ok: true,
  message: "Audit recorded. We'll email a custom ROI report within 2 hours.",
};

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`audit:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(FALLBACK, {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });
  }

  try {
    const body = await req.json();
    const { biz, size, pain, budget, turnstileToken } = body as Record<string, string>;

    if (!(await verifyTurnstile(turnstileToken, ip))) {
      return NextResponse.json(
        { error: "Verification failed. Please refresh and try again." },
        { status: 400 }
      );
    }

    // Capture the audit request as a lead regardless of AI availability.
    await saveLead({
      businessType: biz,
      painPoints: pain,
      source: "audit",
      metadata: { size, budget },
    });

    if (!modelConfigured("audit")) {
      return NextResponse.json(FALLBACK);
    }

    const completion = await callModel({
      purpose: "audit",
      max_tokens: 400,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${SECURITY_PREAMBLE}\n\nYou are a FlowForge AI automation auditor. Given quick-survey answers about a small business, generate a brief ROI summary with 2-3 bullet recommendations and estimated monthly savings. Return JSON: { message: string, recommendations: string[], estimatedSavings: string }`,
        },
        {
          role: "user",
          content: fenceUntrusted(`Business type: ${biz}\nTeam size: ${size}\nBiggest pain: ${pain}\nBudget: ${budget}`),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const json = parseJson(text);
    if (!json) return NextResponse.json(FALLBACK);
    return NextResponse.json({ ok: true, ...json });
  } catch {
    return NextResponse.json(FALLBACK);
  }
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
