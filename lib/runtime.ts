import { getOpenAI } from "@/lib/openai";
import { detectInjection, fenceUntrusted, SECURITY_PREAMBLE } from "@/lib/guardrails";
import type { Trace } from "@/lib/trace";

export type InboxMessage = { from?: string; subject?: string; body?: string };

export type ProposedAction = {
  action: "email.send" | "triage.label" | "archive" | "escalate";
  agent: string;
  summary: string;
  draft?: string;
  needsApproval: boolean;
  source: string;
};

const AGENT = "Inbox triage agent";

const SYSTEM = `${SECURITY_PREAMBLE}

You are an inbox-triage agent for a small business. For EACH email, decide exactly ONE action:
- "email.send": a reply is warranted — write a short, friendly draft reply in the business's voice.
- "triage.label": needs the owner but no auto-reply — summarize why in one line.
- "archive": promotional/newsletter/no action needed.
- "escalate": urgent, sensitive, legal, or an angry customer — flag for a human now.
Return ONLY JSON: { "actions": [ { "action": "...", "summary": "one line", "draft": "reply text — only for email.send" } ] }, one entry per email, in order.`;

/** Normalize an LLM-suggested action label to our enum. */
function normalize(x?: string): ProposedAction["action"] {
  const v = (x ?? "").toLowerCase();
  if (v.includes("send") || v.includes("reply") || v.includes("email")) return "email.send";
  if (v.includes("escal")) return "escalate";
  if (v.includes("arch")) return "archive";
  return "triage.label";
}

function toProposed(subject: string, a?: { action?: string; summary?: string; draft?: string }): ProposedAction {
  const action = normalize(a?.action);
  return {
    action,
    agent: AGENT,
    summary: a?.summary?.slice(0, 200) || defaultSummary(subject, action),
    draft: action === "email.send" ? (a?.draft ?? "").slice(0, 1500) || undefined : undefined,
    needsApproval: action === "email.send" || action === "escalate",
    source: subject,
  };
}

function defaultSummary(subject: string, action: ProposedAction["action"]): string {
  switch (action) {
    case "email.send":
      return `Draft reply to "${subject}"`;
    case "escalate":
      return `Escalate: "${subject}"`;
    case "archive":
      return `Archive: "${subject}"`;
    default:
      return `Label for review: "${subject}"`;
  }
}

/** Keyword heuristic used when OpenAI isn't configured. */
function heuristic(m: { subject: string; body: string }): ProposedAction {
  const s = `${m.subject} ${m.body}`.toLowerCase();
  let action: ProposedAction["action"] = "triage.label";
  if (/unsubscribe|newsletter|\bsale\b|% off|promo/.test(s)) action = "archive";
  else if (/urgent|asap|complaint|refund|angry|legal|lawsuit/.test(s)) action = "escalate";
  else if (/\?|book|reservation|availab|quote|inquiry|question|interested|catering/.test(s)) action = "email.send";
  return {
    action,
    agent: AGENT,
    summary: defaultSummary(m.subject, action),
    draft: action === "email.send" ? `Hi — thanks for reaching out about "${m.subject}". [Draft pending your approval.]` : undefined,
    needsApproval: action === "email.send" || action === "escalate",
    source: m.subject,
  };
}

/**
 * One inbox-triage cycle: read messages (the "tool"), decide one action each
 * via a guarded + fenced LLM step, and return proposed actions. Actions that
 * touch the outside world (email.send / escalate) are marked needsApproval so
 * the caller queues them for human sign-off rather than executing directly.
 */
export async function runInboxTriage(messages: InboxMessage[], trace?: Trace): Promise<ProposedAction[]> {
  const clean = messages.slice(0, 12).map((m) => ({
    from: (m.from ?? "").slice(0, 120),
    subject: (m.subject ?? "(no subject)").slice(0, 200),
    body: (m.body ?? "").slice(0, 1200),
  }));
  trace?.mark("tool.read", { messages: clean.length });

  // Guardrail: untrusted email content may carry injection.
  const injected = clean.some((m) => detectInjection(`${m.subject}\n${m.body}`).flagged);
  trace?.flag("injection", injected);

  if (!process.env.OPENAI_API_KEY) {
    trace?.flag("mode", "heuristic");
    return clean.map((m) => heuristic(m));
  }

  try {
    trace?.mark("model.start");
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: fenceUntrusted(
            clean.map((m, i) => `#${i + 1} From: ${m.from}\nSubject: ${m.subject}\n${m.body}`).join("\n\n")
          ),
        },
      ],
    });
    const tokens = completion.usage?.total_tokens ?? 0;
    trace?.mark("model.end", { tokens });
    trace?.setTokens(tokens);

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      actions?: { action?: string; summary?: string; draft?: string }[];
    };
    const actions = parsed.actions ?? [];
    return clean.map((m, i) => toProposed(m.subject, actions[i]));
  } catch {
    trace?.flag("mode", "heuristic-fallback");
    return clean.map((m) => heuristic(m));
  }
}
