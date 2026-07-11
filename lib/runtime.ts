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
  to?: string;
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

function toProposed(m: { from: string; subject: string }, a?: { action?: string; summary?: string; draft?: string }): ProposedAction {
  const action = normalize(a?.action);
  return {
    action,
    agent: AGENT,
    summary: a?.summary?.slice(0, 200) || defaultSummary(m.subject, action),
    draft: action === "email.send" ? (a?.draft ?? "").slice(0, 1500) || undefined : undefined,
    needsApproval: action === "email.send" || action === "escalate",
    source: m.subject,
    to: m.from || undefined,
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
function heuristic(m: { from: string; subject: string; body: string }): ProposedAction {
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
    to: m.from || undefined,
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
    return clean.map((m, i) => toProposed(m, actions[i]));
  } catch {
    trace?.flag("mode", "heuristic-fallback");
    return clean.map((m) => heuristic(m));
  }
}

// ── AR follow-up agent (accounting) ──────────────────────────────────────────

export type Invoice = { number?: string; customer?: string; email?: string; amount?: number; daysOverdue?: number };
type CleanInvoice = { number: string; customer: string; email: string; amount: number; daysOverdue: number };

const AR_AGENT = "AR follow-up agent";
const AR_SYSTEM = `${SECURITY_PREAMBLE}

You are an accounts-receivable follow-up agent for a small business. For EACH overdue invoice, decide exactly ONE action:
- "email.send": send a polite payment reminder — write a short, professional draft in the business's voice referencing the invoice number, amount, and how overdue it is.
- "escalate": very overdue (60+ days) or a large balance — flag for a human call.
- "triage.label": not yet due or ambiguous — no action.
Return ONLY JSON: { "actions": [ { "action": "...", "summary": "one line", "draft": "reminder text — only for email.send" } ] }, one per invoice, in order.`;

function arSummary(v: CleanInvoice, action: ProposedAction["action"]): string {
  if (action === "email.send") return `Reminder: Invoice ${v.number} · $${v.amount.toLocaleString()} · ${v.daysOverdue}d overdue`;
  if (action === "escalate") return `Escalate: Invoice ${v.number} · $${v.amount.toLocaleString()} · ${v.daysOverdue}d overdue`;
  return `Invoice ${v.number}: not yet due`;
}

function arDraft(v: CleanInvoice): string {
  return `Hi ${v.customer || "there"},\n\nA quick reminder that invoice ${v.number} for $${v.amount.toLocaleString()} is ${v.daysOverdue} days past due. Could you let us know when we can expect payment? Happy to resend the invoice if that helps.\n\nThanks so much!`;
}

function arToProposed(v: CleanInvoice, a?: { action?: string; summary?: string; draft?: string }): ProposedAction {
  const action = normalize(a?.action);
  return {
    action,
    agent: AR_AGENT,
    summary: a?.summary?.slice(0, 200) || arSummary(v, action),
    draft: action === "email.send" ? (a?.draft ?? "").slice(0, 1500) || arDraft(v) : undefined,
    needsApproval: action === "email.send" || action === "escalate",
    source: `Invoice ${v.number}`,
    to: v.email || undefined,
  };
}

function arHeuristic(v: CleanInvoice): ProposedAction {
  let action: ProposedAction["action"] = "triage.label";
  if (v.daysOverdue >= 60) action = "escalate";
  else if (v.daysOverdue >= 1) action = "email.send";
  return {
    action,
    agent: AR_AGENT,
    summary: arSummary(v, action),
    draft: action === "email.send" ? arDraft(v) : undefined,
    needsApproval: action === "email.send" || action === "escalate",
    source: `Invoice ${v.number}`,
    to: v.email || undefined,
  };
}

/**
 * One AR-follow-up cycle: read overdue invoices (from a connected accounting
 * tool, or a provided list) and propose a reminder/escalate per invoice.
 * Outbound reminders are needsApproval → queued, not sent, until a human OKs.
 */
export async function runArFollowup(invoices: Invoice[], trace?: Trace): Promise<ProposedAction[]> {
  const clean: CleanInvoice[] = invoices.slice(0, 20).map((v) => ({
    number: (v.number ?? "").slice(0, 40) || "—",
    customer: (v.customer ?? "").slice(0, 120),
    email: (v.email ?? "").slice(0, 160),
    amount: Number(v.amount) || 0,
    daysOverdue: Number(v.daysOverdue) || 0,
  }));
  trace?.mark("tool.read", { invoices: clean.length });

  if (!process.env.OPENAI_API_KEY) {
    trace?.flag("mode", "heuristic");
    return clean.map((v) => arHeuristic(v));
  }
  try {
    trace?.mark("model.start");
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 900,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AR_SYSTEM },
        {
          role: "user",
          content: fenceUntrusted(
            clean.map((v, i) => `#${i + 1} Invoice ${v.number} — ${v.customer} <${v.email}> — $${v.amount} — ${v.daysOverdue} days overdue`).join("\n")
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
    return clean.map((v, i) => arToProposed(v, actions[i]));
  } catch {
    trace?.flag("mode", "heuristic-fallback");
    return clean.map((v) => arHeuristic(v));
  }
}
