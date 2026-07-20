import { callModel, modelConfigured } from "@/lib/model";
import { detectInjection, fenceUntrusted, SECURITY_PREAMBLE } from "@/lib/guardrails";
import { SYSTEM, AR_SYSTEM, CART_SYSTEM, REVIEW_SYSTEM, LEAD_SYSTEM, SMS_SYSTEM, VOICE_SYSTEM } from "@/lib/prompts";
import type { Trace } from "@/lib/trace";
import { reportWarning } from "@/lib/report";

// Structured-output schemas (roadmap U1): when a lane runs on Claude these
// enforce the JSON shape via structured outputs; OpenAI-compatible providers
// ignore them and keep response_format. Every property is required (empty string
// when N/A) for the widest structured-output compatibility.
const ACTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["actions"],
  properties: {
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "summary", "draft"],
        properties: { action: { type: "string" }, summary: { type: "string" }, draft: { type: "string" } },
      },
    },
  },
};
const ITEMS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["summary", "draft"],
        properties: { summary: { type: "string" }, draft: { type: "string" } },
      },
    },
  },
};

export type InboxMessage = { from?: string; subject?: string; body?: string };

export type ProposedAction = {
  action: "email.send" | "sms.send" | "triage.label" | "archive" | "escalate" | "tool.call";
  agent: string;
  summary: string;
  draft?: string;
  needsApproval: boolean;
  source: string;
  to?: string;
  value?: number; // dollars at stake, for ROI attribution (0/undefined = not tracked)
  // BYOT: a call to a client-registered MCP/HTTP tool. Always approval-gated
  // (never eligible for auto-send), executed via the guarded lib/mcp-client.
  tool?: { toolId: string; name: string; args: Record<string, unknown> };
};

// A poisoned run must never flood the approvals queue with tool calls; cap how
// many tool.call proposals one run may emit.
export const MAX_TOOL_CALLS_PER_RUN = 3;

// Rough per-action value estimates for agents without a concrete dollar amount.
// Conservative on purpose — realized ROI is what the outcome resolves to.
export const VALUE_ESTIMATE = { review: 40, lead: 250 } as const;

/** Prepend the client's business context to a base system prompt when present. */
function sys(base: string, context?: string): string {
  return context ? `${base}\n\n${context}` : base;
}

const AGENT = "Inbox triage agent";

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
export async function runInboxTriage(messages: InboxMessage[], trace?: Trace, context?: string): Promise<ProposedAction[]> {
  const clean = messages.slice(0, 12).map((m) => ({
    from: (m.from ?? "").slice(0, 120),
    subject: (m.subject ?? "(no subject)").slice(0, 200),
    body: (m.body ?? "").slice(0, 1200),
  }));
  trace?.mark("tool.read", { messages: clean.length });

  // Guardrail: untrusted email content may carry injection.
  const injected = clean.some((m) => detectInjection(`${m.subject}\n${m.body}`).flagged);
  trace?.flag("injection", injected);

  if (!modelConfigured("triage")) {
    trace?.flag("mode", "heuristic");
    return clean.map((m) => heuristic(m));
  }

  try {
    trace?.mark("model.start");
    const completion = await callModel({
      purpose: "triage",
      max_tokens: 800,
      temperature: 0.3,
      response_format: { type: "json_object" },
      jsonSchema: ACTIONS_SCHEMA,
      messages: [
        { role: "system", content: sys(SYSTEM, context) },
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
  } catch (err) {
    reportWarning("inbox-triage model call failed; using heuristic", { source: "agent.inbox-triage", detail: { err: String(err) } });
    trace?.flag("mode", "heuristic-fallback");
    return clean.map((m) => heuristic(m));
  }
}

// ── AR follow-up agent (accounting) ──────────────────────────────────────────

export type Invoice = { number?: string; customer?: string; email?: string; amount?: number; daysOverdue?: number };
type CleanInvoice = { number: string; customer: string; email: string; amount: number; daysOverdue: number };

const AR_AGENT = "AR follow-up agent";

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
    value: v.amount,
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
    value: v.amount,
  };
}

/**
 * One AR-follow-up cycle: read overdue invoices (from a connected accounting
 * tool, or a provided list) and propose a reminder/escalate per invoice.
 * Outbound reminders are needsApproval → queued, not sent, until a human OKs.
 */
export async function runArFollowup(invoices: Invoice[], trace?: Trace, context?: string): Promise<ProposedAction[]> {
  const clean: CleanInvoice[] = invoices.slice(0, 20).map((v) => ({
    number: (v.number ?? "").slice(0, 40) || "—",
    customer: (v.customer ?? "").slice(0, 120),
    email: (v.email ?? "").slice(0, 160),
    amount: Number(v.amount) || 0,
    daysOverdue: Number(v.daysOverdue) || 0,
  }));
  trace?.mark("tool.read", { invoices: clean.length });

  if (!modelConfigured("draft")) {
    trace?.flag("mode", "heuristic");
    return clean.map((v) => arHeuristic(v));
  }
  try {
    trace?.mark("model.start");
    const completion = await callModel({
      purpose: "draft",
      max_tokens: 900,
      temperature: 0.3,
      response_format: { type: "json_object" },
      jsonSchema: ACTIONS_SCHEMA,
      messages: [
        { role: "system", content: sys(AR_SYSTEM, context) },
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
  } catch (err) {
    reportWarning("ar-followup model call failed; using heuristic", { source: "agent.ar-followup", detail: { err: String(err) } });
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
  if (!modelConfigured("draft") || lines.length === 0) {
    trace?.flag("mode", "heuristic");
    return [];
  }
  try {
    trace?.mark("model.start");
    const completion = await callModel({
      purpose: "draft",
      max_tokens: maxTokens,
      temperature: 0.4,
      response_format: { type: "json_object" },
      jsonSchema: ITEMS_SCHEMA,
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
  } catch (err) {
    reportWarning("drafting model call failed; using template fallback", { source: "agent.draft", detail: { err: String(err) } });
    trace?.flag("mode", "heuristic-fallback");
    return [];
  }
}

// ── Cart-recovery agent (e-commerce) ─────────────────────────────────────────

export type Cart = { customer?: string; email?: string; phone?: string; total?: number; url?: string; items?: string };

const CART_AGENT = "Cart recovery agent";

export async function runCartRecovery(carts: Cart[], trace?: Trace, context?: string): Promise<ProposedAction[]> {
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
    sys(CART_SYSTEM, context),
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
      value: c.total,
    };
  });
}

// ── Review-request agent (reputation) ────────────────────────────────────────

export type ReviewTarget = { customer?: string; email?: string; phone?: string; service?: string };

const REVIEW_AGENT = "Review request agent";

export async function runReviewRequest(targets: ReviewTarget[], trace?: Trace, context?: string): Promise<ProposedAction[]> {
  const clean = targets.slice(0, 20).map((t) => ({
    customer: (t.customer ?? "").slice(0, 120),
    email: (t.email ?? "").slice(0, 160),
    phone: (t.phone ?? "").slice(0, 40),
    service: (t.service ?? "").slice(0, 200),
  }));
  trace?.mark("tool.read", { targets: clean.length });
  const drafts = await draftMessages(
    sys(REVIEW_SYSTEM, context),
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
      value: VALUE_ESTIMATE.review,
    };
  });
}

// ── Lead-qualification agent (CRM / sales) ───────────────────────────────────

export type Lead = { name?: string; email?: string; phone?: string; source?: string; message?: string };

const LEAD_AGENT = "Lead qualification agent";

export async function runLeadQualification(leads: Lead[], trace?: Trace, context?: string): Promise<ProposedAction[]> {
  const clean = leads.slice(0, 20).map((l) => ({
    name: (l.name ?? "").slice(0, 120),
    email: (l.email ?? "").slice(0, 160),
    phone: (l.phone ?? "").slice(0, 40),
    source: (l.source ?? "").slice(0, 80),
    message: (l.message ?? "").slice(0, 800),
  }));
  trace?.mark("tool.read", { leads: clean.length });
  const drafts = await draftMessages(
    sys(LEAD_SYSTEM, context),
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
      value: VALUE_ESTIMATE.lead,
    };
  });
}

// ── SMS-reply agent (inbound Twilio) ─────────────────────────────────────────

export type InboundSms = { from?: string; to?: string; body?: string };

const SMS_AGENT = "SMS reply agent";

// ── Voice receptionist (inbound Twilio Voice) ────────────────────────────────


/** One spoken turn: given what the caller said, return a short reply to speak. */
export async function runVoiceTurn(said: string, context?: string, trace?: Trace): Promise<string> {
  const fallback = "Thanks for calling! I've noted that and someone from our team will get right back to you.";
  if (!modelConfigured("voice") || !said.trim()) return fallback;
  try {
    trace?.mark("model.start");
    const completion = await callModel({
      purpose: "voice",
      // A reasoning model needs budget for reasoning before the (short) spoken
      // reply; 120 was consumed by reasoning and returned empty.
      max_tokens: 500,
      temperature: 0.5,
      messages: [
        { role: "system", content: sys(`${SECURITY_PREAMBLE}\n\n${VOICE_SYSTEM}`, context) },
        { role: "user", content: fenceUntrusted(said) },
      ],
    });
    trace?.setTokens(completion.usage?.total_tokens ?? 0);
    trace?.mark("model.end");
    return (completion.choices[0]?.message?.content ?? "").trim().slice(0, 400) || fallback;
  } catch (err) {
    reportWarning("voice model call failed; using fallback line", { source: "agent.voice", detail: { err: String(err) } });
    return fallback;
  }
}

export async function runSmsReply(messages: InboundSms[], trace?: Trace, context?: string): Promise<ProposedAction[]> {
  const clean = messages.slice(0, 10).map((m) => ({
    from: (m.from ?? "").slice(0, 40),
    to: (m.to ?? "").slice(0, 40),
    body: (m.body ?? "").slice(0, 600),
  }));
  trace?.mark("tool.read", { messages: clean.length });
  const drafts = await draftMessages(sys(SMS_SYSTEM, context), clean.map((m) => `From ${m.from}: ${m.body}`), trace, 500);
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
