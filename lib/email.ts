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
  // Structured inputs so the client can compute (and let the user adjust) ROI.
  roi?: { tasksPerMonth: number; minutesPerTask: number; hourlyCost: number };
};

const BRAND = "#22d3ee";
const CTA_URL = process.env.NEXT_PUBLIC_CALENDLY_URL ?? "https://flowforge.ai/pricing";

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
        <span style="font-weight:700;font-size:18px;color:#f8fafc">FlowForge <span style="color:${BRAND}">AI</span></span>
      </div>
      <div style="padding:28px">${inner}</div>
      <div style="padding:18px 28px;border-top:1px solid #1e293b;font-size:12px;color:#64748b">
        FlowForge AI · You received this because you requested an automation audit.
      </div>
    </div>
  </div>`;
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
    subject: "Your FlowForge automation scope (3 ideas inside)",
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
    subject: `Your FlowForge automation blueprint: ${b.title}`,
    html: shell(inner),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
