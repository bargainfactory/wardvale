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
    title: "dat.svcLeadTitle",
    description: "dat.svcLeadDesc",
    icon: Sparkles,
    flow: [
      { label: "dat.flowWebformDm", tone: "zap" },
      { label: "dat.flowGptQualifier", tone: "ai" },
      { label: "dat.flowHubspotSheets", tone: "crm" },
      { label: "dat.flowSlackPing", tone: "zap" },
    ],
    outcomes: ["dat.svcLeadOut1", "dat.svcLeadOut2"],
  },
  {
    id: "onboarding",
    title: "dat.svcOnboardTitle",
    description: "dat.svcOnboardDesc",
    icon: ClipboardCheck,
    flow: [
      { label: "dat.flowStripeCharge", tone: "pay" },
      { label: "dat.flowDocusignNotion", tone: "zap" },
      { label: "dat.flowAiWelcomeEmail", tone: "ai" },
      { label: "dat.flowCalendlyKickoff", tone: "crm" },
    ],
    outcomes: ["dat.svcOnboardOut1", "dat.svcOnboardOut2"],
  },
  {
    id: "email-triage",
    title: "dat.svcInboxTitle",
    description: "dat.svcInboxDesc",
    icon: Inbox,
    flow: [
      { label: "dat.flowGmailInbox", tone: "zap" },
      { label: "dat.flowGptClassifier", tone: "ai" },
      { label: "dat.flowDraftReply", tone: "ai" },
      { label: "dat.flowPriorityToYou", tone: "crm" },
    ],
    outcomes: ["dat.svcInboxOut1", "dat.svcInboxOut2"],
  },
  {
    id: "custom-agents",
    title: "dat.svcCustomTitle",
    description: "dat.svcCustomDesc",
    icon: Bot,
    flow: [
      { label: "dat.flowTriggerEvent", tone: "zap" },
      { label: "dat.flowWardvaleAgent", tone: "ai" },
      { label: "dat.flowRunAction", tone: "crm" },
      { label: "dat.flowLogReport", tone: "pay" },
    ],
    outcomes: ["dat.svcCustomOut1", "dat.svcCustomOut2"],
  },
  {
    id: "voice-agent",
    title: "dat.svcVoiceTitle",
    description: "dat.svcVoiceDesc",
    icon: Phone,
    flow: [
      { label: "dat.flowInboundCall", tone: "zap" },
      { label: "dat.flowGptVoiceAgent", tone: "ai" },
      { label: "dat.flowBookRoute", tone: "crm" },
      { label: "dat.flowSmsConfirm", tone: "zap" },
    ],
    outcomes: ["dat.svcVoiceOut1", "dat.svcVoiceOut2"],
  },
  {
    id: "whatsapp-agent",
    title: "dat.svcWhatsappTitle",
    description: "dat.svcWhatsappDesc",
    icon: MessageCircle,
    flow: [
      { label: "dat.flowWhatsappSms", tone: "zap" },
      { label: "dat.flowGptAgent", tone: "ai" },
      { label: "dat.flowBookRecover", tone: "crm" },
      { label: "dat.flowPaymentLink", tone: "pay" },
    ],
    outcomes: ["dat.svcWhatsappOut1", "dat.svcWhatsappOut2"],
  },
  {
    id: "revenue-engine",
    title: "dat.svcRevenueTitle",
    description: "dat.svcRevenueDesc",
    icon: TrendingUp,
    flow: [
      { label: "dat.flowNewLead", tone: "zap" },
      { label: "dat.flowEnrichScore", tone: "ai" },
      { label: "dat.flowMultiTouchNurture", tone: "ai" },
      { label: "dat.flowMeetingBooked", tone: "crm" },
    ],
    outcomes: ["dat.svcRevenueOut1", "dat.svcRevenueOut2"],
  },
  {
    id: "finance-ops",
    title: "dat.svcFinanceTitle",
    description: "dat.svcFinanceDesc",
    icon: Receipt,
    flow: [
      { label: "dat.flowInvoiceReceipt", tone: "pay" },
      { label: "dat.flowAiExtractCode", tone: "ai" },
      { label: "dat.flowSyncToBooks", tone: "crm" },
      { label: "dat.flowDunningReport", tone: "zap" },
    ],
    outcomes: ["dat.svcFinanceOut1", "dat.svcFinanceOut2"],
  },
  {
    id: "reputation",
    title: "dat.svcReputationTitle",
    description: "dat.svcReputationDesc",
    icon: Star,
    flow: [
      { label: "dat.flowJobOrderDone", tone: "zap" },
      { label: "dat.flowAiReviewRequest", tone: "ai" },
      { label: "dat.flowGoogleYelp", tone: "crm" },
      { label: "dat.flowAutoReply", tone: "ai" },
    ],
    outcomes: ["dat.svcReputationOut1", "dat.svcReputationOut2"],
  },
  {
    id: "review-requests",
    title: "dat.svcReviewReqTitle",
    description: "dat.svcReviewReqDesc",
    icon: ThumbsUp,
    flow: [
      { label: "dat.flowScanInboxOrders", tone: "zap" },
      { label: "dat.flowSpotHappyCustomers", tone: "ai" },
      { label: "dat.flowPersonalizedAsk", tone: "ai" },
      { label: "dat.flowGoogleYelpFb", tone: "crm" },
    ],
    outcomes: ["dat.svcReviewReqOut1", "dat.svcReviewReqOut2"],
  },
  {
    id: "automation-rescue",
    title: "dat.svcRescueTitle",
    description: "dat.svcRescueDesc",
    icon: Wrench,
    flow: [
      { label: "dat.flowAuditStack", tone: "zap" },
      { label: "dat.flowFixHarden", tone: "ai" },
      { label: "dat.flowAddGptLayer", tone: "ai" },
      { label: "dat.flowMonitorReport", tone: "crm" },
    ],
    outcomes: ["dat.svcRescueOut1", "dat.svcRescueOut2"],
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
    vertical: "dat.caseNonaVertical",
    icon: Utensils,
    company: "A neighborhood bistro — 2 locations (illustrative)",
    headline: "dat.caseNonaHeadline",
    before: [
      { label: "dat.caseNonaLab1", value: "6h 12m" },
      { label: "dat.caseNonaLab2", value: "22h" },
      { label: "dat.caseNonaLab3", value: "14%" },
    ],
    after: [
      { label: "dat.caseNonaLab1", value: "42s" },
      { label: "dat.caseNonaLab2", value: "3h" },
      { label: "dat.caseNonaLab3", value: "4%" },
    ],
    savings: "dat.caseNonaSavings",
    hoursPerMonth: 76,
  },
  {
    id: "terrafit",
    vertical: "dat.caseTerraVertical",
    icon: ShoppingBag,
    company: "A Shopify apparel brand (illustrative)",
    headline: "dat.caseTerraHeadline",
    before: [
      { label: "dat.caseTerraLab1", value: "4.1%" },
      { label: "dat.caseTerraLab2", value: "9h" },
      { label: "dat.caseTerraLab3", value: "78" },
    ],
    after: [
      { label: "dat.caseTerraLab1", value: "11.8%" },
      { label: "dat.caseTerraLab2", value: "6 min" },
      { label: "dat.caseTerraLab3", value: "94" },
    ],
    savings: "dat.caseTerraSavings",
    hoursPerMonth: 48,
  },
  {
    id: "northline-consult",
    vertical: "dat.caseNorthVertical",
    icon: Briefcase,
    company: "A 6-person consulting boutique (illustrative)",
    headline: "dat.caseNorthHeadline",
    before: [
      { label: "dat.caseNorthLab1", value: "3 days" },
      { label: "dat.caseNorthLab2", value: "17 manual" },
      { label: "dat.caseNorthLab3", value: "22%" },
    ],
    after: [
      { label: "dat.caseNorthLab1", value: "11 min" },
      { label: "dat.caseNorthLab2", value: "0 manual" },
      { label: "dat.caseNorthLab3", value: "41%" },
    ],
    savings: "dat.caseNorthSavings",
    hoursPerMonth: 60,
  },
  {
    id: "pacific-plumb",
    vertical: "dat.casePacificVertical",
    icon: Wrench,
    company: "A 4-truck plumbing team (illustrative)",
    headline: "dat.casePacificHeadline",
    before: [
      { label: "dat.casePacificLab1", value: "62%" },
      { label: "dat.casePacificLab2", value: "18%" },
      { label: "dat.casePacificLab3", value: "11h" },
    ],
    after: [
      { label: "dat.casePacificLab1", value: "3%" },
      { label: "dat.casePacificLab2", value: "96%" },
      { label: "dat.casePacificLab3", value: "4 min" },
    ],
    savings: "dat.casePacificSavings",
    hoursPerMonth: 40,
  },
];

export const steps = [
  {
    n: 1,
    title: "dat.stepDiscoveryTitle",
    desc: "dat.stepDiscoveryDesc",
    icon: LineChart,
  },
  {
    n: 2,
    title: "dat.stepAuditTitle",
    desc: "dat.stepAuditDesc",
    icon: ClipboardCheck,
  },
  {
    n: 3,
    title: "dat.stepBuildTitle",
    desc: "dat.stepBuildDesc",
    icon: Wrench,
  },
  {
    n: 4,
    title: "dat.stepLaunchTitle",
    desc: "dat.stepLaunchDesc",
    icon: Sparkles,
  },
  {
    n: 5,
    title: "dat.stepScaleTitle",
    desc: "dat.stepScaleDesc",
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
    name: "dat.tierStarterName",
    price: 500,
    typicalSavings: 2200,
    tag: "dat.tierStarterTag",
    blurb: "dat.tierStarterBlurb",
    features: [
      "dat.tierStarterF1",
      "dat.tierStarterF2",
      "dat.tierStarterF3",
      "dat.tierStarterF4",
      "dat.tierStarterF5",
    ],
    stripeEnv: "STRIPE_PRICE_STARTER",
  },
  {
    id: "growth",
    name: "dat.tierGrowthName",
    price: 2000,
    typicalSavings: 6000,
    tag: "dat.tierGrowthTag",
    blurb: "dat.tierGrowthBlurb",
    features: [
      "dat.tierGrowthF1",
      "dat.tierGrowthF2",
      "dat.tierGrowthF3",
      "dat.tierGrowthF4",
      "dat.tierGrowthF5",
      "dat.tierGrowthF6",
    ],
    highlighted: true,
    stripeEnv: "STRIPE_PRICE_GROWTH",
  },
  {
    id: "scale",
    name: "dat.tierScaleName",
    price: 5000,
    typicalSavings: 15000,
    tag: "dat.tierScaleTag",
    blurb: "dat.tierScaleBlurb",
    features: [
      "dat.tierScaleF1",
      "dat.tierScaleF2",
      "dat.tierScaleF3",
      "dat.tierScaleF4",
      "dat.tierScaleF5",
      "dat.tierScaleF6",
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

// Illustrative scenarios modeled on the workflows we automate — NOT client
// quotes (we have no permission to fabricate people; see the truth pass).
// name/company are i18n keys; render sites wrap them in t().
export const testimonials: Testimonial[] = [
  {
    quote: "dat.testMarcoQuote",
    name: "dat.testMarcoName",
    role: "dat.testMarcoRole",
    company: "dat.testMarcoCompany",
    metric: "≈+$3.4k/mo",
  },
  {
    quote: "dat.testPriyaQuote",
    name: "dat.testPriyaName",
    role: "dat.testPriyaRole",
    company: "dat.testPriyaCompany",
    metric: "≈+11.8% carts",
  },
  {
    quote: "dat.testDerekQuote",
    name: "dat.testDerekName",
    role: "dat.testDerekRole",
    company: "dat.testDerekCompany",
    metric: "62% → 3% leads lost",
  },
  {
    quote: "dat.testElenaQuote",
    name: "dat.testElenaName",
    role: "dat.testElenaRole",
    company: "dat.testElenaCompany",
    metric: "≈41% win rate",
  },
];

export const trustBadges = [
  "dat.badgeZapierMake",
  "dat.badgeBuiltOpenai",
  "dat.badgeStripeBilling",
  "dat.badgeNoPii",
  "dat.badgeGdpr",
];

export const faq = [
  {
    q: "dat.faq1Q",
    a: "dat.faq1A",
  },
  {
    q: "dat.faq2Q",
    a: "dat.faq2A",
  },
  {
    q: "dat.faq3Q",
    a: "dat.faq3A",
  },
  {
    q: "dat.faq4Q",
    a: "dat.faq4A",
  },
  {
    q: "dat.faq5Q",
    a: "dat.faq5A",
  },
  {
    q: "dat.faq6Q",
    a: "dat.faq6A",
  },
];
