import { getOpenAI } from "@/lib/openai";
import { detectInjection, fenceUntrusted, SECURITY_PREAMBLE } from "@/lib/guardrails";
import type { Trace } from "@/lib/trace";

export type InboxMessage = { from?: string; subject?: string; body?: string };

export type ProposedAction = {
  action: "email.send" | "sms.send" | "triage.label" | "archive" | "escalate";
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

// ── Shared drafting for message-writing agents ───────────────────────────────
// Cart-recovery, review-request, lead-qualification and SMS-reply all follow the
// same shape: read items, write ONE message each, and queue it for approval. The
// channel (email vs SMS) is chosen from what contact info the item carries.

type Draft = { summary?: string; draft?: string };

function channel(email?: string, phone?: string): { action: "email.send" | "sms.send"; to?: string } {
  if (phone) return { action: "sms.send", to: phone };
  return { action: "email.send", to: email || undefined };
}

/**
 * Guarded, fenced, traced LLM drafting. Returns one { summary, draft } per input
 * line (order preserved), or [] when OpenAI isn't configured or the call fails —
 * callers fall back to a template so the agent still works offline.
 */
async function draftMessages(system: string, lines: string[], trace?: Trace, maxTokens = 900): Promise<Draft[]> {
  trace?.flag("injection", lines.some((l) => detectInjection(l).flagged));
  if (!process.env.OPENAI_API_KEY || lines.length === 0) {
    trace?.flag("mode", "heuristic");
    return [];
  }
  try {
    trace?.mark("model.start");
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: maxTokens,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: fenceUntrusted(lines.map((l, i) => `#${i + 1} ${l}`).join("\n\n")) },
      ],
    });
    const tokens = completion.usage?.total_tokens ?? 0;
    trace?.mark("model.end", { tokens });
    trace?.setTokens(tokens);
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { items?: Draft[] };
    return parsed.items ?? [];
  } catch {
    trace?.flag("mode", "heuristic-fallback");
    return [];
  }
}

// ── Cart-recovery agent (e-commerce) ─────────────────────────────────────────

export type Cart = { customer?: string; email?: string; phone?: string; total?: number; url?: string; items?: string };

const CART_AGENT = "Cart recovery agent";
const CART_SYSTEM = `${SECURITY_PREAMBLE}

You are an abandoned-cart recovery agent for an e-commerce store. For EACH cart, write a short, friendly recovery message (2-3 sentences) in the store's voice that nudges the shopper to finish checkout — reference what they left and the checkout link if given. Do not invent discounts.
Return ONLY JSON: { "items": [ { "summary": "one line", "draft": "message text" } ] }, one per cart, in order.`;

export async function runCartRecovery(carts: Cart[], trace?: Trace): Promise<ProposedAction[]> {
  const clean = carts.slice(0, 20).map((c) => ({
    customer: (c.customer ?? "").slice(0, 120),
    email: (c.email ?? "").slice(0, 160),
    phone: (c.phone ?? "").slice(0, 40),
    total: Number(c.total) || 0,
    url: (c.url ?? "").slice(0, 300),
    items: (c.items ?? "").slice(0, 300),
  }));
  trace?.mark("tool.read", { carts: clean.length });
  const drafts = await draftMessages(
    CART_SYSTEM,
    clean.map((c) => `Customer: ${c.customer || "shopper"} · Total: $${c.total} · Items: ${c.items || "n/a"} · Checkout: ${c.url || "n/a"}`),
    trace
  );
  return clean.map((c, i) => {
    const ch = channel(c.email, c.phone);
    const draft =
      drafts[i]?.draft?.slice(0, 1200) ||
      `Hi ${c.customer || "there"}! You left $${c.total} in your cart${c.items ? ` (${c.items})` : ""}. Want to finish checking out? ${c.url}`.trim();
    return {
      action: ch.action,
      agent: CART_AGENT,
      summary: drafts[i]?.summary?.slice(0, 200) || `Recover cart · ${c.customer || "shopper"} · $${c.total}`,
      draft,
      needsApproval: true,
      source: `Cart ${c.customer || c.email || i + 1}`,
      to: ch.to,
    };
  });
}

// ── Review-request agent (reputation) ────────────────────────────────────────

export type ReviewTarget = { customer?: string; email?: string; phone?: string; service?: string };

const REVIEW_AGENT = "Review request agent";
const REVIEW_SYSTEM = `${SECURITY_PREAMBLE}

You are a review-request agent for a small business. For EACH recently completed order/job, write a short, warm message asking the happy customer to leave a review (Google/Yelp). Personalize with their name and what they bought or booked, include a clear ask, and do not offer incentives.
Return ONLY JSON: { "items": [ { "summary": "one line", "draft": "message text" } ] }, one per customer, in order.`;

export async function runReviewRequest(targets: ReviewTarget[], trace?: Trace): Promise<ProposedAction[]> {
  const clean = targets.slice(0, 20).map((t) => ({
    customer: (t.customer ?? "").slice(0, 120),
    email: (t.email ?? "").slice(0, 160),
    phone: (t.phone ?? "").slice(0, 40),
    service: (t.service ?? "").slice(0, 200),
  }));
  trace?.mark("tool.read", { targets: clean.length });
  const drafts = await draftMessages(
    REVIEW_SYSTEM,
    clean.map((t) => `Customer: ${t.customer || "customer"} · Bought/booked: ${t.service || "n/a"}`),
    trace
  );
  return clean.map((t, i) => {
    const ch = channel(t.email, t.phone);
    const draft =
      drafts[i]?.draft?.slice(0, 1000) ||
      `Hi ${t.customer || "there"}! Thanks so much for choosing us${t.service ? ` for ${t.service}` : ""}. If you have a moment, would you mind leaving us a quick review? It really helps. Thank you!`;
    return {
      action: ch.action,
      agent: REVIEW_AGENT,
      summary: drafts[i]?.summary?.slice(0, 200) || `Review request · ${t.customer || "customer"}`,
      draft,
      needsApproval: true,
      source: `Review · ${t.customer || t.email || i + 1}`,
      to: ch.to,
    };
  });
}

// ── Lead-qualification agent (CRM / sales) ───────────────────────────────────

export type Lead = { name?: string; email?: string; phone?: string; source?: string; message?: string };

const LEAD_AGENT = "Lead qualification agent";
const LEAD_SYSTEM = `${SECURITY_PREAMBLE}

You are a lead-qualification + first-response agent for a small business. For EACH new lead, classify intent (hot/warm/cold) in the summary, then write a fast, friendly first-touch reply that asks one or two qualifying questions and offers a next step (call or booking). Keep it short.
Return ONLY JSON: { "items": [ { "summary": "hot|warm|cold — one line", "draft": "reply text" } ] }, one per lead, in order.`;

export async function runLeadQualification(leads: Lead[], trace?: Trace): Promise<ProposedAction[]> {
  const clean = leads.slice(0, 20).map((l) => ({
    name: (l.name ?? "").slice(0, 120),
    email: (l.email ?? "").slice(0, 160),
    phone: (l.phone ?? "").slice(0, 40),
    source: (l.source ?? "").slice(0, 80),
    message: (l.message ?? "").slice(0, 800),
  }));
  trace?.mark("tool.read", { leads: clean.length });
  const drafts = await draftMessages(
    LEAD_SYSTEM,
    clean.map((l) => `Lead: ${l.name || "unknown"} · Source: ${l.source || "n/a"} · Message: ${l.message || "n/a"}`),
    trace
  );
  return clean.map((l, i) => {
    const ch = channel(l.email, l.phone);
    const draft =
      drafts[i]?.draft?.slice(0, 1200) ||
      `Hi ${l.name || "there"}, thanks for reaching out! To point you the right way — what are you looking for and what's your timeline? Happy to hop on a quick call.`;
    return {
      action: ch.action,
      agent: LEAD_AGENT,
      summary: drafts[i]?.summary?.slice(0, 200) || `New lead · ${l.name || "unknown"} (${l.source || "n/a"})`,
      draft,
      needsApproval: true,
      source: `Lead ${l.name || l.email || i + 1}`,
      to: ch.to,
    };
  });
}

// ── SMS-reply agent (inbound Twilio) ─────────────────────────────────────────

export type InboundSms = { from?: string; to?: string; body?: string };

const SMS_AGENT = "SMS reply agent";
const SMS_SYSTEM = `${SECURITY_PREAMBLE}

You are an SMS assistant for a small business replying to inbound texts (e.g. a missed-call auto-text-back or a customer question). Write ONE concise, friendly SMS reply (max 320 chars) that answers or moves toward booking. If a message is spam or an opt-out (STOP/UNSUBSCRIBE), leave the draft empty and say so in the summary.
Return ONLY JSON: { "items": [ { "summary": "one line", "draft": "sms text" } ] }, one per message, in order.`;

export async function runSmsReply(messages: InboundSms[], trace?: Trace): Promise<ProposedAction[]> {
  const clean = messages.slice(0, 10).map((m) => ({
    from: (m.from ?? "").slice(0, 40),
    to: (m.to ?? "").slice(0, 40),
    body: (m.body ?? "").slice(0, 600),
  }));
  trace?.mark("tool.read", { messages: clean.length });
  const drafts = await draftMessages(SMS_SYSTEM, clean.map((m) => `From ${m.from}: ${m.body}`), trace, 500);
  return clean.map((m, i) => {
    const draft = drafts[i]?.draft?.slice(0, 480) || `Thanks for your text! We got your message and will reply shortly. — the team`;
    return {
      action: "sms.send" as const,
      agent: SMS_AGENT,
      summary: drafts[i]?.summary?.slice(0, 200) || `Reply to ${m.from}`,
      draft,
      needsApproval: true,
      source: `SMS from ${m.from}`,
      to: m.from || undefined,
    };
  });
}
