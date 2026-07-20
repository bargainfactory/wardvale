import { NextResponse } from "next/server";
import { callModel, modelConfigured } from "@/lib/model";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { saveLead } from "@/lib/leads";
import { sendWorkflowBlueprint, type Blueprint } from "@/lib/email";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { fenceUntrusted, SECURITY_PREAMBLE } from "@/lib/guardrails";
import { overBudget, recordTokens, DAILY_TOKEN_CAP } from "@/lib/usage";
import { firstTime, idemKey } from "@/lib/idempotency";
import { startTrace } from "@/lib/trace";

type Msg = { role: "user" | "assistant"; content: string };
type Attachment = { kind?: "image" | "text"; name?: string; dataUrl?: string; text?: string };

const SYSTEM = `You are Wardvale's workflow discovery agent. Through a focused back-and-forth you help a small-business owner describe ONE workflow they want automated, then produce a concrete, buildable automation blueprint.

ASKING RULES
- Ask exactly ONE question per turn. Under 25 words, friendly and concrete, with a quick example in parentheses.
- BEFORE each question, re-read the whole conversation and work out which SLOTS below are already filled. NEVER ask about a slot that is already answered — not even reworded, narrowed, or "just to confirm". If an answer partly covered a slot, treat that slot as FILLED and move to the next EMPTY one.
- Never ask two questions about the same slot. If their answer was vague, do NOT repeat it — extract what you can and ask the next EMPTY slot instead.
- Ask the highest-value EMPTY slot next. Skip any slot that clearly doesn't apply to their workflow.

SLOTS (priority order)
1. TASK — the specific task that eats their time.
2. TRIGGER — the exact event that starts it and where it arrives (call, form, email, order…).
3. SYSTEMS — the tools / systems of record involved, and where the data lives.
4. VOLUME — how often it happens and how long each one takes today.
5. DECISION RULES — the judgment the human applies today: how they decide what to do, classify, prioritize, or what to say. This is what makes the agent sharp — always cover it.
6. EXCEPTIONS — the cases that must go to a human instead of being handled automatically.
7. AUTONOMY — should the agent act on its own, or draft and wait for approval?
8. VOICE — tone/brand rules for anything customer-facing (skip entirely for internal workflows).
9. OUTCOME — what "done right" looks like.

- Slots 1-5 are mandatory. Once those are covered (usually 5-7 answers) set done=true and produce the blueprint. NEVER ask more than 8 questions total.

OPTIONAL EXTRAS — capture these ONLY if they surface naturally in an answer; NEVER spend a dedicated question on them and never let them push you over the 8-question limit:
- PRIORITY: if they mention several competing tasks, which matters most right now.
- SUCCESS METRIC: the one number that tells them it's working (hours saved/week, response time, reviews/month).
- TEAM SIZE: how many people touch this workflow today.

OUTPUT — respond with ONLY valid JSON in this exact shape:
{ "done": boolean, "progress": number (0-100),
  "question"?: string,
  "blueprint"?: { "title": string, "summary": string, "trigger": string,
    "steps": [{ "label": string, "tool": string }],
    "tools": string[], "estimatedSavings": string,
    "suggestedTier": "starter" | "growth" | "scale", "nextStep": string,
    "decisionRules": string[], "escalation": string, "autonomy": "auto" | "approve",
    "roi": { "tasksPerMonth": number, "minutesPerTask": number, "hourlyCost": number },
    "priority"?: string, "successMetric"?: string, "teamSize"?: string } }
- "decisionRules": 2-4 concrete if/then rules the agent will follow, written from THEIR OWN answers (e.g. "If the caller asks for a table under 6, book it directly in OpenTable; if 6+, flag for the manager"). Never generic filler.
- "escalation": the specific cases this agent hands to a human, in their words.
- "autonomy": ONLY use "auto" if they explicitly said they want it to act unattended. If they never stated a preference (e.g. you never reached the AUTONOMY slot), you MUST use "approve" — Wardvale is human-in-the-loop by default and every outbound action is approval-gated. Do not infer "auto" from them describing routine cases.
- For "roi", estimate realistic numbers from what they told you: tasksPerMonth (how many times the workflow runs per month), minutesPerTask (minutes of manual work each run takes today), and hourlyCost (a fair loaded hourly cost for whoever does it now, USD, typically 20-45). Make "estimatedSavings" roughly consistent with tasksPerMonth × minutesPerTask / 60 × hourlyCost.
When done=false include "question" and omit "blueprint". When done=true include "blueprint" and omit "question".`;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`workflow:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { done: false, progress: 0, question: "One moment — you're going a little fast. Try again in a few seconds." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    // Industry is chosen up front in the Start experience; sanitize (it's fed
    // into the system prompt) and keep it short.
    const industry =
      typeof body.industry === "string" ? body.industry.replace(/[\r\n`]+/g, " ").trim().slice(0, 80) : "";

    // Action: persist + email the finished blueprint.
    if (body.action === "email") {
      // This sends an email to a caller-chosen address, so bound it far tighter
      // than the general workflow limit — otherwise it's an email-amplification
      // vector (blast blueprint emails via our sender). Reliable IP after the
      // clientIp() hardening. Silently no-op past the cap.
      const emailRl = await rateLimit(`wf-email:${ip}`, 5, 60 * 60_000);
      if (!emailRl.ok) return NextResponse.json({ ok: true, throttled: true });
      const { name, email, businessType, blueprint } = body as {
        name?: string;
        email?: string;
        businessType?: string;
        blueprint?: Blueprint;
      };
      // Idempotency: a double-submit shouldn't save the lead or email twice.
      if (!firstTime(idemKey("wf-action", email, blueprint?.title), 5 * 60 * 1000)) {
        return NextResponse.json({ ok: true, deduped: true });
      }
      await saveLead({
        name,
        email,
        businessType: businessType ?? industry ?? blueprint?.title,
        painPoints: blueprint?.summary,
        source: "workflow",
        metadata: { blueprint, industry },
      });
      if (email && blueprint) {
        await sendWorkflowBlueprint({ to: email, name, blueprint });
      }
      return NextResponse.json({ ok: true });
    }

    const messages: Msg[] = Array.isArray(body.messages) ? body.messages : [];

    const trace = startTrace("workflow", typeof body?.sessionId === "string" ? body.sessionId : undefined);
    trace.setInput([...messages].reverse().find((m) => m.role === "user")?.content ?? "");

    if (!modelConfigured()) {
      trace.flag("noKey", true);
      trace.setStatus("fallback");
      await trace.end();
      return NextResponse.json(scriptedFallback(messages, industry));
    }

    const answered = messages.filter((m) => m.role === "user").length;
    const nudge =
      answered >= 7 ? "\n\nYou now have plenty of detail — set done=true and return the blueprint." : "";
    const industryClause = industry
      ? `\n\nThe user has ALREADY chosen their industry: ${industry}. That slot is FILLED — never ask what business they run. Tailor every question, every parenthetical example, and the final blueprint specifically to a ${industry} business.`
      : "";

    // Localize the interview + blueprint to the visitor's site language.
    const LANGS: Record<string, string> = { es: "Spanish", fr: "French", pt: "Portuguese", de: "German" };
    const langName = LANGS[typeof body.locale === "string" ? body.locale : ""];
    const langClause = langName
      ? `\n\nWrite EVERYTHING you output — every question, every parenthetical example, and all blueprint text — in ${langName}, regardless of the language the user answers in.`
      : "";

    // Deterministic anti-repeat guard: replaying the questions already asked as an
    // explicit checklist stops the model rewording a filled slot (it drifted on
    // SYSTEMS when this was only implied by the transcript).
    const askedQs = messages.filter((m) => m.role === "assistant").map((m) => m.content);
    const askedClause = askedQs.length
      ? `\n\nQUESTIONS YOU HAVE ALREADY ASKED — do NOT ask any of these again, and do NOT ask a reworded question seeking the same information. Their slots are FILLED; move to the next EMPTY slot:\n${askedQs
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n")}`
      : "";

    const attachment: Attachment | undefined = body.attachment;
    const apiMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: `${SECURITY_PREAMBLE}\n\n${SYSTEM}${industryClause}${langClause}${askedClause}${nudge}` },
    ];
    messages.forEach((m, i) => {
      const isLast = i === messages.length - 1;
      if (isLast && m.role === "user" && attachment) {
        // Image → vision content part; small enough to inline as a data URL.
        if (attachment.kind === "image" && attachment.dataUrl && attachment.dataUrl.length < 1_500_000) {
          apiMessages.push({
            role: "user",
            content: [
              { type: "text", text: m.content || "Here's what I'm working with — use it to scope the automation." },
              { type: "image_url", image_url: { url: attachment.dataUrl } },
            ],
          });
          return;
        }
        // Text/CSV → append the extracted content for grounding.
        if (attachment.kind === "text" && attachment.text) {
          apiMessages.push({
            role: "user",
            content: `${m.content}\n\n[Attached file: ${attachment.name ?? "file"}]\n${fenceUntrusted(attachment.text)}`,
          });
          return;
        }
      }
      apiMessages.push({ role: m.role, content: m.content });
    });

    // Cost guardrail: fall back to the scripted flow if this IP is over budget.
    if (overBudget(`ai:${ip}`, DAILY_TOKEN_CAP)) {
      // Silent degradation here is very hard to diagnose (it looks like the model
      // "went generic"), so say so explicitly.
      console.warn(`[workflow] fallback: daily token cap (${DAILY_TOKEN_CAP}) reached for this IP — serving scripted interview`);
      trace.flag("overBudget", true);
      trace.setStatus("fallback");
      await trace.end();
      return NextResponse.json(scriptedFallback(messages, industry));
    }

    if (attachment) trace.flag("attachment", attachment.kind ?? "unknown");
    trace.mark("model.start");
    // If the provider is unavailable (missing credits, outage, rate limit, bad
    // key), degrade to the scripted interview rather than dead-ending the
    // funnel — same graceful path as the no-key case.
    let completion;
    try {
      completion = await callModel({
        purpose: "workflow",
        max_tokens: 700,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: apiMessages,
      });
    } catch (err) {
      console.warn("[workflow] fallback: provider error —", err instanceof Error ? err.message : err);
      trace.flag("providerError", err instanceof Error ? err.message.slice(0, 120) : "unknown");
      trace.setStatus("provider_error");
      await trace.end();
      return NextResponse.json(scriptedFallback(messages, industry));
    }
    const tokens = completion.usage?.total_tokens ?? 0;
    recordTokens(`ai:${ip}`, tokens);
    const content = completion.choices[0]?.message?.content ?? "";
    trace.mark("model.end", { tokens });
    trace.setTokens(tokens);
    trace.setOutput(content);

    const parsed = parseJson(content);
    if (!parsed) {
      console.warn(`[workflow] fallback: model reply did not parse as JSON (len=${content.length})`);
      trace.setStatus("parse_fail");
      await trace.end();
      return NextResponse.json(scriptedFallback(messages, industry));
    }
    trace.flag("done", Boolean(parsed.done));
    await trace.end();
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({
      done: false,
      progress: 0,
      question: "Sorry — I hit a snag. Could you rephrase your last answer?",
    });
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

// Deterministic interview + blueprint used when OpenAI isn't configured, so the
// feature is fully demoable offline.
const SCRIPT = [
  "What kind of business do you run? (e.g. restaurant, Shopify store, plumbing)",
  "Which task eats the most time right now? (e.g. answering the same emails, following up leads)",
  "What kicks it off? (a web form, an email, a missed call, a new order…)",
  "Which tools are involved? (e.g. Gmail, Shopify, Google Sheets, HubSpot)",
  "How often does it happen — daily, per order, weekly? And roughly how many?",
];

function scriptedFallback(messages: Msg[], industry = "") {
  // When the industry was chosen up front, skip the "what business?" question
  // and seed it as the first value.
  const script = industry ? SCRIPT.slice(1) : SCRIPT;
  const answers = messages.filter((m) => m.role === "user").map((m) => m.content);
  const i = answers.length;
  if (i < script.length) {
    return { done: false, progress: Math.round((i / script.length) * 90), question: script[i] };
  }
  const [biz = "your business", task = "a repetitive task", trigger = "an inbound event", tools = "your tools", volume = ""] =
    industry ? [industry, ...answers] : answers;
  const roi = estimateRoi(volume);
  const monthly = Math.round((roi.tasksPerMonth * roi.minutesPerTask) / 60 * roi.hourlyCost);
  const blueprint: Blueprint = {
    title: `Automate: ${truncate(task, 48)}`,
    summary: `A Wardvale agent that handles "${truncate(task, 60)}" for ${truncate(biz, 40)} end-to-end.`,
    trigger: truncate(trigger, 60),
    steps: [
      { label: "Trigger detected", tool: truncate(trigger, 24) },
      { label: "AI reads & decides", tool: "GPT agent" },
      { label: "Action taken", tool: truncate(tools, 24) },
      { label: "Logged + reported", tool: "Portal" },
    ],
    tools: tools.split(/[,/]|and/i).map((t) => t.trim()).filter(Boolean).slice(0, 5),
    estimatedSavings: `~$${monthly.toLocaleString()}/mo`,
    suggestedTier: monthly < 2500 ? "starter" : monthly < 7000 ? "growth" : "scale",
    nextStep: "Book a 30-min discovery call to scope and price this build.",
    decisionRules: [
      `Handle the routine "${truncate(task, 40)}" cases end-to-end without you.`,
      `Log every run to ${truncate(tools, 30)} so nothing is lost.`,
      "Anything ambiguous or high-value is drafted for your approval instead of sent.",
    ],
    escalation: "Complaints, edge cases, and anything outside the usual pattern go straight to a human.",
    autonomy: "approve",
    roi,
  };
  return { done: true, progress: 100, blueprint };
}

// Rough ROI inputs parsed from a free-text volume answer (e.g. "about 30 a day").
function estimateRoi(volume: string): { tasksPerMonth: number; minutesPerTask: number; hourlyCost: number } {
  const num = parseInt(volume.replace(/[, ]/g, "").match(/\d+/)?.[0] ?? "", 10);
  let tasksPerMonth = 400;
  if (!Number.isNaN(num)) {
    if (/day|daily/i.test(volume)) tasksPerMonth = num * 30;
    else if (/week/i.test(volume)) tasksPerMonth = num * 4;
    else if (/hour/i.test(volume)) tasksPerMonth = num * 30 * 8;
    else if (/month/i.test(volume)) tasksPerMonth = num;
    else tasksPerMonth = num * 30; // assume per-day if unqualified
  }
  return {
    tasksPerMonth: Math.min(Math.max(tasksPerMonth, 10), 20000),
    minutesPerTask: 5,
    hourlyCost: 25,
  };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
