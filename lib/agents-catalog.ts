// Single source of truth for the agent catalog, subscription entitlements, and
// one-click industry packs. Provisioning, the scheduler, the onboarding wizard,
// the config UI, and entitlement checks all read from here.

export type AgentKey =
  | "inbox-triage"
  | "ar-followup"
  | "cart-recovery"
  | "review-request"
  | "lead-qualification"
  | "support-triage"
  // Wave 2 — from the July 2026 cross-vertical SMB pain-point research.
  // Every lane is approval-gated; none is ever auto-armed at onboarding.
  | "winback"
  | "quote-followup"
  | "hiring-assist"
  | "referral-ask"
  | "noshow-shield"
  | "review-response"
  | "shift-cover"
  | "content-drafter"
  | "doc-chaser"
  | "dispute-fighter";

export type Schedule = "manual" | "hourly" | "daily" | "off";

export type AgentDef = {
  key: AgentKey;
  name: string;
  blurb: string;
  connectors: string[]; // connector ids this agent can pull/act through
};

export const AGENTS: AgentDef[] = [
  { key: "inbox-triage", name: "Inbox triage", blurb: "Reads email, drafts replies, routes and escalates.", connectors: ["google", "microsoft"] },
  { key: "ar-followup", name: "AR follow-up", blurb: "Chases overdue invoices with polite, escalating reminders.", connectors: ["quickbooks", "xero"] },
  { key: "cart-recovery", name: "Cart recovery", blurb: "Wins back abandoned checkouts by email or SMS.", connectors: ["shopify", "twilio"] },
  { key: "review-request", name: "Review requests", blurb: "Asks happy customers for Google/Yelp reviews.", connectors: ["shopify", "google-business", "twilio"] },
  { key: "lead-qualification", name: "Lead follow-up", blurb: "Qualifies new leads and sends a fast first touch.", connectors: ["hubspot", "salesforce", "twilio"] },
  { key: "support-triage", name: "Support triage", blurb: "Triages and drafts replies for support tickets.", connectors: ["zendesk", "gorgias", "intercom"] },
  // ── Wave 2 ──
  { key: "winback", name: "Win-back", blurb: "Spots lapsed regulars and drafts personal we-miss-you outreach.", connectors: ["shopify", "quickbooks", "twilio"] },
  { key: "quote-followup", name: "Quote follow-up", blurb: "Chases open quotes and estimates so winnable jobs stop dying in silence.", connectors: ["quickbooks", "twilio"] },
  { key: "hiring-assist", name: "Hiring first-touch", blurb: "Replies to job applicants same-day with screening questions and interview slots.", connectors: ["google", "microsoft", "twilio"] },
  { key: "referral-ask", name: "Referral requests", blurb: "Catches happy moments and drafts a personal referral ask.", connectors: ["twilio"] },
  { key: "noshow-shield", name: "No-show shield", blurb: "Confirms appointments, flags risky slots, and drafts backfill offers on cancellations.", connectors: ["google", "twilio"] },
  { key: "review-response", name: "Review responses", blurb: "Drafts replies to new reviews — public response plus a private make-it-right note.", connectors: ["google-business"] },
  { key: "shift-cover", name: "Shift cover", blurb: "On a call-out, drafts targeted cover-request texts to eligible staff.", connectors: ["twilio"] },
  { key: "content-drafter", name: "Content drafter", blurb: "Turns your week's real activity into drafted posts and a newsletter.", connectors: ["google-business"] },
  { key: "doc-chaser", name: "Document chaser", blurb: "Tracks what each client still owes you and drafts polite escalating nudges.", connectors: ["google", "microsoft"] },
  { key: "dispute-fighter", name: "Dispute fighter", blurb: "Assembles evidence and drafts chargeback and platform-fee dispute filings.", connectors: ["shopify", "stripe"] },
];

export const AGENT_KEYS = AGENTS.map((a) => a.key);
export function isAgentKey(x: string): x is AgentKey {
  return (AGENT_KEYS as string[]).includes(x);
}
export function agentName(key: string): string {
  return AGENTS.find((a) => a.key === key)?.name ?? key;
}

// ── Plans & entitlements ─────────────────────────────────────────────────────

export type Plan = "trial" | "starter" | "growth" | "scale";

export type Entitlement = {
  label: string;
  maxAgents: number; // how many agents may be enabled at once
  schedules: Schedule[]; // cadences this plan may use
};

export const PLANS: Record<Plan, Entitlement> = {
  trial: { label: "Trial", maxAgents: 1, schedules: ["manual", "off"] },
  starter: { label: "Starter", maxAgents: 2, schedules: ["manual", "daily", "off"] },
  growth: { label: "Growth", maxAgents: 4, schedules: ["manual", "daily", "hourly", "off"] },
  scale: { label: "Scale", maxAgents: AGENTS.length, schedules: ["manual", "daily", "hourly", "off"] },
};

export function planOf(plan: string | null | undefined): Plan {
  return plan === "starter" || plan === "growth" || plan === "scale" ? plan : "trial";
}

// Monthly retainer per plan — used to compute proven ROI multiples + break-even.
export const PLAN_PRICE: Record<Plan, number> = { trial: 0, starter: 500, growth: 2000, scale: 5000 };
export function planPrice(plan: string | null | undefined): number {
  return PLAN_PRICE[planOf(plan)];
}
export function entitlement(plan: string | null | undefined): Entitlement {
  return PLANS[planOf(plan)];
}
export function scheduleAllowed(plan: string | null | undefined, schedule: Schedule): boolean {
  return entitlement(plan).schedules.includes(schedule);
}

// Map a Stripe tier/price nickname to a plan. Tolerant of casing + common names.
export function planFromTier(tier: string | null | undefined): Plan {
  const t = (tier ?? "").toLowerCase();
  if (t.includes("scale")) return "scale";
  if (t.includes("growth")) return "growth";
  if (t.includes("starter") || t.includes("basic")) return "starter";
  return "starter"; // any paid checkout is at least starter
}

// ── One-click industry packs ─────────────────────────────────────────────────

export type Pack = {
  id: string;
  name: string;
  industry: string;
  agents: AgentKey[];
  connectors: string[];
  tone: string;
};

export const PACKS: Pack[] = [
  {
    id: "restaurant",
    name: "Restaurant OS",
    industry: "Restaurant / hospitality",
    agents: ["inbox-triage", "review-request", "winback", "shift-cover", "hiring-assist", "review-response"],
    connectors: ["google", "google-business", "twilio", "meta"],
    tone: "warm, welcoming, and concise",
  },
  {
    id: "home-services",
    name: "Home-Services OS",
    industry: "Home & field services",
    agents: ["inbox-triage", "lead-qualification", "quote-followup", "noshow-shield", "referral-ask", "review-request"],
    connectors: ["twilio", "jobber", "google-business"],
    tone: "friendly, prompt, and reassuring",
  },
  {
    id: "clinic",
    name: "Clinic & Dental OS",
    industry: "Healthcare / clinics",
    agents: ["inbox-triage", "noshow-shield", "winback", "review-response", "review-request", "support-triage"],
    connectors: ["google", "microsoft", "twilio"],
    tone: "calm, professional, and clear",
  },
  {
    id: "real-estate",
    name: "Real-Estate OS",
    industry: "Real estate",
    agents: ["lead-qualification", "inbox-triage", "doc-chaser", "referral-ask", "review-request", "content-drafter"],
    connectors: ["hubspot", "twilio", "docusign"],
    tone: "responsive, polished, and helpful",
  },
  {
    id: "law-firm",
    name: "Law-Firm OS",
    industry: "Legal / professional services",
    agents: ["inbox-triage", "lead-qualification", "doc-chaser", "quote-followup", "ar-followup", "support-triage"],
    connectors: ["microsoft", "clio", "docusign"],
    tone: "precise, discreet, and professional",
  },
  {
    id: "ecommerce",
    name: "E-commerce OS",
    industry: "E-commerce / retail",
    agents: ["cart-recovery", "winback", "dispute-fighter", "review-response", "support-triage", "review-request"],
    connectors: ["shopify", "klaviyo", "gorgias", "twilio"],
    tone: "upbeat, on-brand, and helpful",
  },
];

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}
