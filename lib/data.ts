import type { LucideIcon } from "lucide-react";
import {
  Bot,
  ClipboardCheck,
  ShoppingBag,
  Utensils,
  Briefcase,
  Wrench,
  LineChart,
  Inbox,
  Sparkles,
  Phone,
  MessageCircle,
  TrendingUp,
  Receipt,
  Star,
  ThumbsUp,
} from "lucide-react";

export type Service = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  flow: { label: string; tone: "zap" | "ai" | "crm" | "pay" }[];
  outcomes: string[];
};

export const services: Service[] = [
  {
    id: "lead-capture",
    title: "Lead Capture & Qualification",
    description:
      "Every form, DM and missed call is triaged by an AI agent, scored, and dropped into your CRM with a reply already drafted.",
    icon: Sparkles,
    flow: [
      { label: "Webform / DM", tone: "zap" },
      { label: "GPT qualifier", tone: "ai" },
      { label: "HubSpot / Sheets", tone: "crm" },
      { label: "Slack ping", tone: "zap" },
    ],
    outcomes: ["↑ 38% reply rate", "↓ 6h/week saved"],
  },
  {
    id: "onboarding",
    title: "Client Onboarding Autopilot",
    description:
      "Stripe payment triggers a 7-step onboarding — contracts, portal invites, welcome video, Slack channel, kickoff booked.",
    icon: ClipboardCheck,
    flow: [
      { label: "Stripe charge", tone: "pay" },
      { label: "Docusign + Notion", tone: "zap" },
      { label: "AI welcome email", tone: "ai" },
      { label: "Calendly kickoff", tone: "crm" },
    ],
    outcomes: ["0 manual touchpoints", "100% on-time kickoffs"],
  },
  {
    id: "email-triage",
    title: "Inbox Triage Agent",
    description:
      "A custom GPT agent reads every inbound email, labels, drafts a reply in your voice, and only escalates the 5% that need you.",
    icon: Inbox,
    flow: [
      { label: "Gmail inbox", tone: "zap" },
      { label: "GPT classifier", tone: "ai" },
      { label: "Draft reply", tone: "ai" },
      { label: "Priority to you", tone: "crm" },
    ],
    outcomes: ["↓ 82% inbox time", "9 min avg response"],
  },
  {
    id: "custom-agents",
    title: "Custom Workflow Agents",
    description:
      "Bespoke agents for menu updates, review replies, inventory re-orders, appointment reminders — whatever eats your day.",
    icon: Bot,
    flow: [
      { label: "Trigger event", tone: "zap" },
      { label: "FlowForge agent", tone: "ai" },
      { label: "Run action", tone: "crm" },
      { label: "Log + report", tone: "pay" },
    ],
    outcomes: ["$1,200+/mo labor saved", "24/7 always-on"],
  },
  {
    id: "voice-agent",
    title: "AI Voice Receptionist",
    description:
      "A 24/7 AI phone agent that answers every call, qualifies the caller, and books the job or appointment straight into your calendar — no missed calls, no voicemail.",
    icon: Phone,
    flow: [
      { label: "Inbound call", tone: "zap" },
      { label: "GPT voice agent", tone: "ai" },
      { label: "Book / route", tone: "crm" },
      { label: "SMS confirm", tone: "zap" },
    ],
    outcomes: ["0 missed calls", "Books 24/7"],
  },
  {
    id: "whatsapp-agent",
    title: "WhatsApp & SMS Agent",
    description:
      "A conversational agent that sells, books, and supports over WhatsApp and SMS — in your customer's language. Meet mobile-first markets where they already are.",
    icon: MessageCircle,
    flow: [
      { label: "WhatsApp / SMS", tone: "zap" },
      { label: "GPT agent", tone: "ai" },
      { label: "Book / recover", tone: "crm" },
      { label: "Payment link", tone: "pay" },
    ],
    outcomes: ["Multilingual", "90%+ open rate"],
  },
  {
    id: "revenue-engine",
    title: "AI Sales Follow-up",
    description:
      "An always-on SDR that enriches every lead, runs personalized multi-touch follow-up, and books meetings on your calendar — so no opportunity ever goes cold.",
    icon: TrendingUp,
    flow: [
      { label: "New lead", tone: "zap" },
      { label: "Enrich + score", tone: "ai" },
      { label: "Multi-touch nurture", tone: "ai" },
      { label: "Meeting booked", tone: "crm" },
    ],
    outcomes: ["3x follow-up", "Zero leads dropped"],
  },
  {
    id: "finance-ops",
    title: "Finance & Back-Office",
    description:
      "Automate the paperwork that eats your week: invoice capture, AP/AR, expense categorization, dunning, and month-end prep — reconciled and ready for your bookkeeper.",
    icon: Receipt,
    flow: [
      { label: "Invoice / receipt", tone: "pay" },
      { label: "AI extract + code", tone: "ai" },
      { label: "Sync to books", tone: "crm" },
      { label: "Dunning + report", tone: "zap" },
    ],
    outcomes: ["90% less data entry", "Faster month-end"],
  },
  {
    id: "reputation",
    title: "Reviews & Reputation",
    description:
      "Ask every happy customer for a review at the perfect moment and auto-respond to every Google and Yelp review in your voice — turning reputation into a growth channel.",
    icon: Star,
    flow: [
      { label: "Job / order done", tone: "zap" },
      { label: "AI review request", tone: "ai" },
      { label: "Google / Yelp", tone: "crm" },
      { label: "Auto-reply", tone: "ai" },
    ],
    outcomes: ["5x review rate", "Replies in minutes"],
  },
  {
    id: "review-requests",
    title: "Review Request Agent",
    description:
      "The agent scans your inbox and payment records for happy, completed customers, then automatically asks each one for a review — on Google, Yelp, Facebook and Trustpilot — at the perfect moment and in your voice.",
    icon: ThumbsUp,
    flow: [
      { label: "Scan inbox / orders", tone: "zap" },
      { label: "Spot happy customers", tone: "ai" },
      { label: "Personalized ask", tone: "ai" },
      { label: "Google / Yelp / FB", tone: "crm" },
    ],
    outcomes: ["5x more reviews", "Auto-timed, on-brand"],
  },
  {
    id: "automation-rescue",
    title: "Automation Rescue Audit",
    description:
      "Already on Zapier or Make but held together with duct tape? We audit what you have, fix the broken flows, and bolt on the GPT layer they can't give you.",
    icon: Wrench,
    flow: [
      { label: "Audit your stack", tone: "zap" },
      { label: "Fix + harden", tone: "ai" },
      { label: "Add GPT layer", tone: "ai" },
      { label: "Monitor + report", tone: "crm" },
    ],
    outcomes: ["Fixes duct-tape", "Fast wins"],
  },
];

export type CaseStudy = {
  id: string;
  vertical: string;
  icon: LucideIcon;
  company: string;
  headline: string;
  before: { label: string; value: string }[];
  after: { label: string; value: string }[];
  savings: string;
  hoursPerMonth: number;
};

export const caseStudies: CaseStudy[] = [
  {
    id: "nona-bistro",
    vertical: "Restaurant",
    icon: Utensils,
    company: "Nona Bistro — 2 locations, Austin TX",
    headline: "Replaced a front-of-house admin with a reservations + review agent.",
    before: [
      { label: "Reply time to DMs", value: "6h 12m" },
      { label: "Weekly admin hours", value: "22h" },
      { label: "No-show rate", value: "14%" },
    ],
    after: [
      { label: "Reply time to DMs", value: "42s" },
      { label: "Weekly admin hours", value: "3h" },
      { label: "No-show rate", value: "4%" },
    ],
    savings: "$3,400 / month",
    hoursPerMonth: 76,
  },
  {
    id: "terrafit",
    vertical: "E-commerce",
    icon: ShoppingBag,
    company: "TerraFit Apparel — Shopify, $90k/mo",
    headline: "Abandoned cart + CS inbox running on a single GPT agent stack.",
    before: [
      { label: "Cart recovery", value: "4.1%" },
      { label: "CS response time", value: "9h" },
      { label: "CSAT", value: "78" },
    ],
    after: [
      { label: "Cart recovery", value: "11.8%" },
      { label: "CS response time", value: "6 min" },
      { label: "CSAT", value: "94" },
    ],
    savings: "$7,200 / month",
    hoursPerMonth: 48,
  },
  {
    id: "northline-consult",
    vertical: "Consulting",
    icon: Briefcase,
    company: "Northline Consulting — 6-person boutique",
    headline: "Proposal-to-paid in 11 minutes, fully automated.",
    before: [
      { label: "Proposal turnaround", value: "3 days" },
      { label: "Onboarding steps", value: "17 manual" },
      { label: "Win rate", value: "22%" },
    ],
    after: [
      { label: "Proposal turnaround", value: "11 min" },
      { label: "Onboarding steps", value: "0 manual" },
      { label: "Win rate", value: "41%" },
    ],
    savings: "$5,600 / month",
    hoursPerMonth: 60,
  },
  {
    id: "pacific-plumb",
    vertical: "Local services",
    icon: Wrench,
    company: "Pacific Plumbing — 4-truck team, Seattle",
    headline: "Missed-call-to-booked-job agent captures 100% of after-hours leads.",
    before: [
      { label: "After-hours leads lost", value: "62%" },
      { label: "Review request rate", value: "18%" },
      { label: "Avg job-booking lag", value: "11h" },
    ],
    after: [
      { label: "After-hours leads lost", value: "3%" },
      { label: "Review request rate", value: "96%" },
      { label: "Avg job-booking lag", value: "4 min" },
    ],
    savings: "$4,800 / month",
    hoursPerMonth: 40,
  },
];

export const steps = [
  {
    n: 1,
    title: "Discovery",
    desc: "30-min call to map your top 3 revenue leaks. You leave with a scoped plan.",
    icon: LineChart,
  },
  {
    n: 2,
    title: "Audit",
    desc: "We shadow your tools for 48h and return a ranked list of automations by ROI.",
    icon: ClipboardCheck,
  },
  {
    n: 3,
    title: "Build",
    desc: "Zapier flows + custom GPT agents wired into your stack. Tested on real data.",
    icon: Wrench,
  },
  {
    n: 4,
    title: "Launch",
    desc: "Go-live in 14 days with training videos, runbooks, and a Slack warroom.",
    icon: Sparkles,
  },
  {
    n: 5,
    title: "Scale",
    desc: "Monthly retainer: new agents, monitoring, iteration, always-on support.",
    icon: Bot,
  },
] as const;

export type Tier = {
  id: "starter" | "growth" | "scale";
  name: string;
  price: number;
  /** Typical monthly savings a client on this tier sees — powers the ROI badge. */
  typicalSavings: number;
  tag: string;
  blurb: string;
  features: string[];
  highlighted?: boolean;
  stripeEnv: string;
};

export const tiers: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    price: 500,
    typicalSavings: 2200,
    tag: "Solo operators",
    blurb: "1 flagship automation + inbox triage. Ship in 10 days.",
    features: [
      "1 flagship Zapier flow (up to 12 steps)",
      "Inbox triage agent in your voice",
      "Monthly tune-up call",
      "Slack support (48h SLA)",
      "Portal with run logs",
    ],
    stripeEnv: "STRIPE_PRICE_STARTER",
  },
  {
    id: "growth",
    name: "Growth",
    price: 2000,
    typicalSavings: 6000,
    tag: "Most popular",
    blurb: "Up to 5 automations + custom GPT agent. Full-funnel coverage.",
    features: [
      "Up to 5 production automations",
      "1 custom GPT agent (e.g. reviews, proposals)",
      "Weekly optimization cycles",
      "Slack warroom (12h SLA)",
      "Portal + monthly ROI reporting",
      "Team training session",
    ],
    highlighted: true,
    stripeEnv: "STRIPE_PRICE_GROWTH",
  },
  {
    id: "scale",
    name: "Scale",
    price: 5000,
    typicalSavings: 15000,
    tag: "Multi-location / 7-figure",
    blurb: "Unlimited automations, dedicated agent engineer, priority everything.",
    features: [
      "Unlimited production automations",
      "2 custom GPT agents + voice agent",
      "Dedicated automation engineer",
      "Same-day priority SLA",
      "Quarterly strategy offsite (remote)",
      "Portal + live KPI dashboard",
    ],
    stripeEnv: "STRIPE_PRICE_SCALE",
  },
];

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  metric: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "We replaced two part-time admins with FlowForge. Five weeks in, we're booking 30% more reservations and I have my Sundays back.",
    name: "Marco Delgado",
    role: "Owner",
    company: "Nona Bistro",
    metric: "+$3.4k/mo",
  },
  {
    quote:
      "The onboarding agent alone paid for a year of retainer in the first month. It just… works.",
    name: "Priya Shah",
    role: "Founder",
    company: "TerraFit Apparel",
    metric: "+11.8% carts",
  },
  {
    quote:
      "I was skeptical. Then the missed-call agent booked three $1,200 jobs on a Saturday night while I slept.",
    name: "Derek Kwon",
    role: "Ops Lead",
    company: "Pacific Plumbing",
    metric: "62% → 3% leads lost",
  },
  {
    quote:
      "Better than hiring an ops manager. Cheaper, faster, and it never takes a vacation.",
    name: "Elena Fischer",
    role: "Managing Partner",
    company: "Northline Consulting",
    metric: "41% win rate",
  },
];

export const trustBadges = [
  "Zapier & Make experts",
  "Built on OpenAI",
  "Stripe-secured billing",
  "No customer PII stored",
  "GDPR-ready",
];

export const faq = [
  {
    q: "How fast will I see ROI?",
    a: "Most clients break even within 21 days of launch. Our typical Growth-tier engagement returns 4–9× the monthly retainer in hard cost savings by month 3.",
  },
  {
    q: "Do I need technical staff?",
    a: "No. We run the build, the ops, and the monitoring. You get a Loom walkthrough, a runbook, and Slack access. If something breaks, we fix it — usually before you notice.",
  },
  {
    q: "What tools do you integrate with?",
    a: "Anything with an API. Native expertise in Zapier, Make, HubSpot, Shopify, Stripe, Gmail/Outlook, Calendly, Notion, Airtable, Slack, Twilio, and OpenAI/Anthropic.",
  },
  {
    q: "Can I cancel month-to-month?",
    a: "Yes. All retainers are month-to-month after a 30-day onboarding. You keep every automation we build — it's yours, running in your own accounts.",
  },
  {
    q: "Is my data safe?",
    a: "We run on your infrastructure (your Zapier, your OpenAI key, your DB). We never store customer PII. GDPR-ready, signed DPA on request.",
  },
  {
    q: "What if I already have Zapier set up?",
    a: "Even better. We audit what you have, fix the duct-tape, and bolt on the GPT layer that Zapier alone can't give you.",
  },
];
