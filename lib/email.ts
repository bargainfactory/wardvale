// Transactional email via the Resend REST API (no SDK dependency).
// Gracefully no-ops when RESEND_API_KEY / EMAIL_FROM are unset so the lead
// flow never breaks on a missing integration.

type Idea = { title: string; description: string; savingsEstimate: string };

export type Blueprint = {
  title: string;
  summary: string;
  trigger: string;
  steps: { label: string; tool: string }[];
  tools: string[];
  estimatedSavings: string;
  suggestedTier: "starter" | "growth" | "scale";
  nextStep: string;
  /** Concrete if/then rules the agent follows — drawn from the owner's own answers. */
  decisionRules?: string[];
  /** The specific cases this agent hands to a human. */
  escalation?: string;
  /** Whether the agent acts unattended or drafts for approval first. */
  autonomy?: "auto" | "approve";
  // Structured inputs so the client can compute (and let the user adjust) ROI.
  roi?: { tasksPerMonth: number; minutesPerTask: number; hourlyCost: number };
  // Optional pre-sale discovery signals — captured only if surfaced naturally.
  priority?: string;
  successMetric?: string;
  teamSize?: string;
};

const BRAND = "#22d3ee";
const CTA_URL = process.env.NEXT_PUBLIC_CALENDLY_URL ?? "https://wardvale.com/pricing";

async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !opts.to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("Resend send failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendEmail error:", err);
    return false;
  }
}

function shell(inner: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#050a14;color:#e2e8f0;padding:32px">
    <div style="max-width:560px;margin:0 auto;background:#0b1220;border:1px solid #1e293b;border-radius:16px;overflow:hidden">
      <div style="padding:24px 28px;border-bottom:1px solid #1e293b">
        <span style="font-weight:700;font-size:18px;color:#f8fafc">Ward<span style="color:${BRAND}">vale</span></span>
      </div>
      <div style="padding:28px">${inner}</div>
      <div style="padding:18px 28px;border-top:1px solid #1e293b;font-size:12px;color:#64748b">
        Wardvale · You received this because you requested an automation audit.
      </div>
    </div>
  </div>`;
}

/**
 * Welcome email for a client who just completed checkout. Gets them to sign in
 * and configure their agents in the Design Studio. Links to the normal magic-link
 * sign-in with a `next` back to the studio (we do NOT self-mint a login link).
 * No-ops when Resend is unconfigured, so the Stripe webhook never breaks on it.
 */
export async function sendWelcome(input: { to: string; name?: string }): Promise<boolean> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wardvale.com";
  const studioUrl = `${site}/portal/login?next=/portal/studio`;
  const hello = input.name ? `Welcome, ${escapeHtml(input.name)}` : "Welcome to Wardvale";
  const inner = `
    <h1 style="font-size:22px;color:#f8fafc;margin:0 0 8px">${hello} 👋</h1>
    <p style="color:#94a3b8;margin:0 0 16px">You're all set. The next step is the <strong style="color:#e2e8f0">Agent Design Studio</strong> — a few minutes to tell your agents about your business, pick what they work on, and set how much they do on their own. Nothing sends without your approval.</p>
    <a href="${studioUrl}" style="display:inline-block;background:${BRAND};color:#0b1220;font-weight:600;padding:12px 20px;border-radius:10px;text-decoration:none">Design your agents →</a>
    <p style="color:#64748b;font-size:13px;margin:18px 0 0">We'll email you a secure sign-in link when you click through.</p>`;
  return sendEmail({ to: input.to, subject: "Welcome to Wardvale — let's set up your agents", html: shell(inner) });
}

/**
 * The five-minute morning: daily digest of drafts waiting for approval, framed
 * as a short ritual ("7 drafts — about 3 minutes"), with a peek at the top items
 * and the learning-loop counter. This is the crank handle of the receipts moat:
 * every approval trains the agents AND mints a verifiable outcome.
 */
export async function sendMorningDigest(input: {
  to: string;
  name?: string;
  pending: number;
  minutes: number;
  summaries: string[];
  learned: number;
  portalUrl: string;
}): Promise<boolean> {
  const first = input.name?.split(" ")[0] || "there";
  const s = input.pending === 1 ? "" : "s";
  const items = input.summaries
    .slice(0, 3)
    .map((x) => `<li style="color:#94a3b8;margin:4px 0">${escapeHtml(x)}</li>`)
    .join("");
  const inner = `
    <h1 style="font-size:22px;color:#f8fafc;margin:0 0 8px">Good morning, ${escapeHtml(first)} — ${input.pending} draft${s}, about ${input.minutes} minute${input.minutes === 1 ? "" : "s"}</h1>
    <p style="color:#94a3b8;margin:0 0 12px">Your agents drafted these overnight. Nothing sends until you approve it.</p>
    ${items ? `<ul style="margin:0 0 16px;padding-left:18px">${items}</ul>` : ""}
    <a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;background:${BRAND};color:#0b1220;font-weight:600;padding:12px 20px;border-radius:10px;text-decoration:none">Approve in the portal →</a>
    ${input.learned > 0 ? `<p style="color:#64748b;font-size:12px;margin:18px 0 0">Every decision teaches your agents your voice — ${input.learned.toLocaleString()} so far.</p>` : ""}`;
  return sendEmail({
    to: input.to,
    subject: `${input.pending} draft${s} waiting — about ${input.minutes} min`,
    html: shell(inner),
  });
}

/**
 * Monthly ROI recap for a paying client. Callers MUST pass only REAL realized
 * outcome figures (see the roi-digest cron) — never illustrative numbers. This is
 * the retention moat: it puts a dollar value on the service every month.
 */
export async function sendRoiDigest(input: {
  to: string;
  name?: string;
  dollarsSaved: number;
  hoursSaved: number;
  runs: number;
  periodLabel: string;
  portalUrl: string;
}): Promise<boolean> {
  const first = input.name?.split(" ")[0] || "there";
  const stat = (value: string, label: string) =>
    `<td style="padding:10px 6px;text-align:center">
      <div style="font-size:26px;font-weight:700;color:${BRAND}">${escapeHtml(value)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px">${escapeHtml(label)}</div>
    </td>`;
  const inner = `
    <h1 style="font-size:22px;color:#f8fafc;margin:0 0 8px">Your automation impact, ${escapeHtml(first)}</h1>
    <p style="color:#94a3b8;margin:0 0 16px">Here's what your Wardvale agents delivered over ${escapeHtml(input.periodLabel)}.</p>
    <table style="width:100%;border:1px solid #1e293b;border-radius:12px;border-collapse:separate"><tr>
      ${stat(`$${Math.round(input.dollarsSaved).toLocaleString()}`, "saved")}
      ${stat(`${Math.round(input.hoursSaved).toLocaleString()}h`, "reclaimed")}
      ${stat(input.runs.toLocaleString(), "actions run")}
    </tr></table>
    <a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;margin-top:20px;background:${BRAND};color:#0b1220;font-weight:600;padding:12px 20px;border-radius:10px;text-decoration:none">View your live dashboard →</a>`;
  return sendEmail({
    to: input.to,
    subject: `Wardvale saved you $${Math.round(input.dollarsSaved).toLocaleString()} this month`,
    html: shell(inner),
  });
}

/** Emails the lead their 3 scoped automation ideas after the quote form. */
export async function sendQuoteReport(input: {
  to: string;
  name?: string;
  businessType?: string;
  ideas: Idea[];
}): Promise<boolean> {
  const first = input.name?.split(" ")[0] || "there";
  const cards = input.ideas
    .map(
      (i) => `<div style="border:1px solid #1e293b;border-radius:12px;padding:16px;margin:12px 0">
        <div style="font-weight:600;color:#f8fafc">${escapeHtml(i.title)}</div>
        <div style="color:#94a3b8;font-size:14px;margin-top:4px">${escapeHtml(i.description)}</div>
        <div style="color:${BRAND};font-weight:600;margin-top:8px">${escapeHtml(i.savingsEstimate)}</div>
      </div>`
    )
    .join("");

  const inner = `
    <h1 style="font-size:22px;color:#f8fafc;margin:0 0 8px">Your automation scope, ${escapeHtml(first)}</h1>
    <p style="color:#94a3b8;margin:0 0 12px">Here are 3 high-impact automations we matched to your ${escapeHtml(
      input.businessType || "business"
    )}.</p>
    ${cards}
    <a href="${CTA_URL}" style="display:inline-block;margin-top:16px;background:${BRAND};color:#0b1220;font-weight:600;padding:12px 20px;border-radius:10px;text-decoration:none">Book your discovery call →</a>`;

  return sendEmail({
    to: input.to,
    subject: "Your Wardvale automation scope (3 ideas inside)",
    html: shell(inner),
  });
}

/** Emails the automation blueprint produced by the workflow builder. */
export async function sendWorkflowBlueprint(input: {
  to: string;
  name?: string;
  blueprint: Blueprint;
}): Promise<boolean> {
  const b = input.blueprint;
  const first = input.name?.split(" ")[0] || "there";
  const steps = b.steps
    .map(
      (s, i) => `<tr>
        <td style="padding:6px 10px;color:${BRAND};font-weight:600;width:24px">${i + 1}</td>
        <td style="padding:6px 10px;color:#e2e8f0">${escapeHtml(s.label)}</td>
        <td style="padding:6px 10px;color:#94a3b8;text-align:right">${escapeHtml(s.tool)}</td>
      </tr>`
    )
    .join("");

  const inner = `
    <h1 style="font-size:22px;color:#f8fafc;margin:0 0 4px">Your automation blueprint, ${escapeHtml(first)}</h1>
    <div style="font-weight:600;color:${BRAND};font-size:15px">${escapeHtml(b.title)}</div>
    <p style="color:#94a3b8;margin:8px 0 16px">${escapeHtml(b.summary)}</p>
    <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Trigger</div>
    <div style="color:#e2e8f0;margin-bottom:16px">${escapeHtml(b.trigger)}</div>
    <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Flow</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">${steps}</table>
    <div style="display:flex;gap:16px;margin-bottom:16px">
      <div><div style="color:#64748b;font-size:12px">Est. savings</div><div style="color:${BRAND};font-weight:700;font-size:18px">${escapeHtml(b.estimatedSavings)}</div></div>
      <div><div style="color:#64748b;font-size:12px">Suggested plan</div><div style="color:#f8fafc;font-weight:700;font-size:18px;text-transform:capitalize">${escapeHtml(b.suggestedTier)}</div></div>
    </div>
    <a href="${CTA_URL}" style="display:inline-block;background:${BRAND};color:#0b1220;font-weight:600;padding:12px 20px;border-radius:10px;text-decoration:none">${escapeHtml(b.nextStep)} →</a>`;

  return sendEmail({
    to: input.to,
    subject: `Your Wardvale automation blueprint: ${b.title}`,
    html: shell(inner),
  });
}

/** Tell the owner they have agent drafts waiting for approval. */
export async function sendApprovalNotification(to: string, count: number, agentLabel?: string): Promise<boolean> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wardvale.com";
  const s = count === 1 ? "" : "s";
  const inner = `
    <h1 style="font-size:22px;color:#f8fafc;margin:0 0 8px">You have ${count} draft${s} to review</h1>
    <p style="color:#94a3b8;margin:0 0 16px">${
      agentLabel ? `Your ${escapeHtml(agentLabel)} ` : "Your agents "
    }queued ${count} action${s} for approval. Nothing is sent until you say so.</p>
    <a href="${site}/portal" style="display:inline-block;background:${BRAND};color:#0b1220;font-weight:600;padding:12px 20px;border-radius:10px;text-decoration:none">Review in your portal →</a>`;
  return sendEmail({ to, subject: `${count} agent draft${s} awaiting your approval`, html: shell(inner) });
}

/** Send an agent-drafted reply that a human has approved. */
export async function sendAgentEmail(to: string, subject: string, body: string): Promise<boolean> {
  const subj = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
  const inner = `<p style="color:#e2e8f0;white-space:pre-wrap;line-height:1.5">${escapeHtml(body)}</p>`;
  return sendEmail({ to, subject: subj, html: shell(inner) });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
