import { NextResponse } from "next/server";
import { callModel, modelConfigured } from "@/lib/model";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { saveLead } from "@/lib/leads";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendQuoteReport } from "@/lib/email";
import { fenceUntrusted, SECURITY_PREAMBLE } from "@/lib/guardrails";

type Idea = { title: string; description: string; savingsEstimate: string };

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`quote:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ideas: defaultIdeas("general"), rateLimited: true },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const { name, email, businessType, painPoints, turnstileToken } = body as {
      name: string;
      email: string;
      businessType: string;
      painPoints: string;
      turnstileToken?: string;
    };

    if (!(await verifyTurnstile(turnstileToken, ip))) {
      return NextResponse.json(
        { error: "Verification failed. Please refresh and try again." },
        { status: 400 }
      );
    }

    // Persist the lead first so it's captured even if the AI step fails.
    await saveLead({ name, email, businessType, painPoints, source: "quote" });

    const ideas = await generateIdeas({ name, email, businessType, painPoints });

    // Best-effort report email (no-ops if Resend isn't configured).
    if (email) {
      await sendQuoteReport({ to: email, name, businessType, ideas });
    }

    return NextResponse.json({ ideas });
  } catch {
    return NextResponse.json({ ideas: defaultIdeas("general") });
  }
}

async function generateIdeas(input: {
  name: string;
  email: string;
  businessType: string;
  painPoints: string;
}): Promise<Idea[]> {
  if (!modelConfigured("quote")) return defaultIdeas(input.businessType);
  try {
    const completion = await callModel({
      purpose: "quote",
      max_tokens: 600,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${SECURITY_PREAMBLE}\n\nYou are a senior automation strategist at Wardvale. Given a small business's profile, generate exactly 3 high-impact Zapier + GPT automation ideas. Each idea must have: title (short), description (1 sentence), savingsEstimate (monthly dollar savings string like "~$800/mo"). Return ONLY valid JSON: { "ideas": [...] }`,
        },
        {
          role: "user",
          content: fenceUntrusted(`Business: ${input.businessType}\nContact: ${input.name} (${input.email})\nPain points: ${input.painPoints || "general admin overload"}`),
        },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    const json = parseJson(text);
    return json?.ideas?.length ? (json.ideas as Idea[]) : defaultIdeas(input.businessType);
  } catch {
    return defaultIdeas(input.businessType);
  }
}

function parseJson(text: string): { ideas?: unknown[] } | null {
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

function defaultIdeas(biz: string): Idea[] {
  return [
    {
      title: "Inbox Triage Agent",
      description: `AI reads & drafts replies to every inbound email for your ${biz} in your voice.`,
      savingsEstimate: "~$800/mo",
    },
    {
      title: "Lead Capture Flow",
      description: "Every form, DM, and missed call → CRM + instant reply.",
      savingsEstimate: "~$1,200/mo",
    },
    {
      title: "Review Response Bot",
      description: "Auto-reply to Google/Yelp reviews within 15 minutes.",
      savingsEstimate: "~$400/mo",
    },
  ];
}
