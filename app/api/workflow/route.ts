import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
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

const SYSTEM = `You are FlowForge AI's workflow discovery agent. Through a short back-and-forth you help a small-business owner describe ONE workflow they want automated, then produce a concrete automation blueprint.

Rules:
- Ask exactly ONE question per turn. Keep it under 25 words, friendly and concrete, with a quick example in parentheses.
- Across the conversation, adaptively cover: (1) their business/vertical, (2) the specific task that eats time, (3) the trigger that starts it, (4) the tools/systems involved, (5) volume/frequency, (6) the ideal outcome.
- Never re-ask something they already answered. Once you have enough (usually ~5 answers), set done=true and produce the blueprint.
- Respond with ONLY valid JSON in this exact shape:
{ "done": boolean, "progress": number (0-100),
  "question"?: string,
  "blueprint"?: { "title": string, "summary": string, "trigger": string,
    "steps": [{ "label": string, "tool": string }],
    "tools": string[], "estimatedSavings": string,
    "suggestedTier": "starter" | "growth" | "scale", "nextStep": string,
    "roi": { "tasksPerMonth": number, "minutesPerTask": number, "hourlyCost": number } } }
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

    // Action: persist + email the finished blueprint.
    if (body.action === "email") {
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
        businessType: businessType ?? blueprint?.title,
        painPoints: blueprint?.summary,
        source: "workflow",
        metadata: { blueprint },
      });
      if (email && blueprint) {
        await sendWorkflowBlueprint({ to: email, name, blueprint });
      }
      return NextResponse.json({ ok: true });
    }

    const messages: Msg[] = Array.isArray(body.messages) ? body.messages : [];

    const trace = startTrace("workflow", typeof body?.sessionId === "string" ? body.sessionId : undefined);
    trace.setInput([...messages].reverse().find((m) => m.role === "user")?.content ?? "");

    if (!process.env.OPENAI_API_KEY) {
      trace.flag("noKey", true);
      trace.setStatus("fallback");
      await trace.end();
      return NextResponse.json(scriptedFallback(messages));
    }

    const answered = messages.filter((m) => m.role === "user").length;
    const nudge =
      answered >= 7 ? "\n\nYou now have plenty of detail — set done=true and return the blueprint." : "";

    const attachment: Attachment | undefined = body.attachment;
    const apiMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: `${SECURITY_PREAMBLE}\n\n${SYSTEM}${nudge}` },
    ];
    messages.forEach((m, i) => {
      const isLast = i === messages.length - 1;
      if (isLast && m.role === "user" && attachment) {
        // Image → vision content part; small enough to inline as a data URL.
        if (attachment.kind === "image" && attachment.dataUrl && attachment.dataUrl.length < 7_000_000) {
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
      trace.flag("overBudget", true);
      trace.setStatus("fallback");
      await trace.end();
      return NextResponse.json(scriptedFallback(messages));
    }

    if (attachment) trace.flag("attachment", attachment.kind ?? "unknown");
    trace.mark("model.start");
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 700,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: apiMessages,
    });
    const tokens = completion.usage?.total_tokens ?? 0;
    recordTokens(`ai:${ip}`, tokens);
    const content = completion.choices[0]?.message?.content ?? "";
    trace.mark("model.end", { tokens });
    trace.setTokens(tokens);
    trace.setOutput(content);

    const parsed = parseJson(content);
    if (!parsed) {
      trace.setStatus("parse_fail");
      await trace.end();
      return NextResponse.json(scriptedFallback(messages));
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

function scriptedFallback(messages: Msg[]) {
  const answers = messages.filter((m) => m.role === "user").map((m) => m.content);
  const i = answers.length;
  if (i < SCRIPT.length) {
    return { done: false, progress: Math.round((i / SCRIPT.length) * 90), question: SCRIPT[i] };
  }
  const [biz = "your business", task = "a repetitive task", trigger = "an inbound event", tools = "your tools", volume = ""] =
    answers;
  const roi = estimateRoi(volume);
  const monthly = Math.round((roi.tasksPerMonth * roi.minutesPerTask) / 60 * roi.hourlyCost);
  const blueprint: Blueprint = {
    title: `Automate: ${truncate(task, 48)}`,
    summary: `A FlowForge agent that handles "${truncate(task, 60)}" for ${truncate(biz, 40)} end-to-end.`,
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
