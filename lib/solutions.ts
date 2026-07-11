import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Building2,
  Car,
  Dumbbell,
  HeartPulse,
  MessageCircle,
  PawPrint,
  Phone,
  Receipt,
  Scale,
  ShoppingBag,
  Star,
  Stethoscope,
  TrendingUp,
  Umbrella,
  Utensils,
  Wrench,
} from "lucide-react";

export type Bundle = {
  name: string;
  slug: string; // → /automations/{slug}
  icon: LucideIcon;
  tagline: string;
  includes: string[];
  savings: string; // display, e.g. "~$3,400/mo"
  basePrice: number; // monthly retainer for the base OS
  baseSavings: number; // typical monthly savings
  vertical: string; // for getBenchmark()
};

export const bundles: Bundle[] = [
  {
    name: "Restaurant OS",
    slug: "restaurant-reservation-and-review-agent",
    icon: Utensils,
    tagline: "Fill tables, protect your reputation, and win back your Sundays.",
    includes: ["Reservation & review agent", "WhatsApp booking agent", "Inbox & DM triage", "No-show reminders"],
    savings: "~$3,400/mo",
    basePrice: 1800,
    baseSavings: 3400,
    vertical: "Restaurant",
  },
  {
    name: "Home-Services OS",
    slug: "ai-phone-agent-for-home-services",
    icon: Wrench,
    tagline: "Never miss an after-hours call — turn every ring into a booked job.",
    includes: ["AI phone answering agent", "Missed-call → booked job", "Quote follow-up", "Review requests"],
    savings: "~$4,800/mo",
    basePrice: 2200,
    baseSavings: 4800,
    vertical: "Home services",
  },
  {
    name: "Clinic & Dental OS",
    slug: "ai-voice-receptionist-for-dental-practices",
    icon: Stethoscope,
    tagline: "A 24/7 front desk that books, reminds, and rebooks — zero hold music.",
    includes: ["AI voice receptionist", "Appointment reminders", "Rebooking & recalls", "Intake automation"],
    savings: "~$5,200/mo",
    basePrice: 2600,
    baseSavings: 5200,
    vertical: "Dental",
  },
  {
    name: "Real-Estate OS",
    slug: "real-estate-lead-qualification-and-follow-up",
    icon: Building2,
    tagline: "Qualify and nurture every lead the second it lands — day or night.",
    includes: ["Lead qualification agent", "Multi-touch follow-up", "WhatsApp & SMS agent", "Showing scheduler"],
    savings: "~$5,600/mo",
    basePrice: 2400,
    baseSavings: 5600,
    vertical: "Real estate",
  },
  {
    name: "Law-Firm OS",
    slug: "ai-voice-agent-for-law-firms",
    icon: Scale,
    tagline: "Capture every new-client call and collect what you need — automatically.",
    includes: ["AI intake call agent", "Conflict & intake questions", "Document collection", "Consult scheduling"],
    savings: "~$4,200/mo",
    basePrice: 2200,
    baseSavings: 4200,
    vertical: "Law firm",
  },
  {
    name: "E-commerce OS",
    slug: "shopify-store-abandoned-cart-recovery",
    icon: ShoppingBag,
    tagline: "Recover carts, answer buyers, and grow reviews on autopilot.",
    includes: ["Abandoned-cart recovery", "WhatsApp sales & support", "Support inbox triage", "Review engine"],
    savings: "~$7,200/mo",
    basePrice: 2800,
    baseSavings: 7200,
    vertical: "E-commerce",
  },
  {
    name: "Med Spa & Aesthetics OS",
    slug: "med-spa-booking-and-rebooking-agent",
    icon: HeartPulse,
    tagline: "Fill every chair — book consults, save cancellations, prompt rebooking.",
    includes: ["Booking & consult agent", "Cancellation-fill waitlist", "Rebooking & recalls", "Review requests"],
    savings: "~$5,000/mo",
    basePrice: 2400,
    baseSavings: 5000,
    vertical: "Med spa",
  },
  {
    name: "Veterinary OS",
    slug: "veterinary-appointment-reminders-and-recalls",
    icon: PawPrint,
    tagline: "Keep the schedule full and pets on track — reminders, recalls, triage.",
    includes: ["Appointment reminders", "Vaccine & wellness recalls", "After-hours triage", "Review requests"],
    savings: "~$4,400/mo",
    basePrice: 2200,
    baseSavings: 4400,
    vertical: "Veterinary",
  },
  {
    name: "Fitness & Wellness OS",
    slug: "gym-fitness-membership-onboarding-and-winback",
    icon: Dumbbell,
    tagline: "Turn trials into members and win back the ones drifting away.",
    includes: ["Trial-to-member nurture", "Class booking agent", "No-show winback", "Membership onboarding"],
    savings: "~$3,600/mo",
    basePrice: 1800,
    baseSavings: 3600,
    vertical: "Fitness",
  },
  {
    name: "Auto — Dealership & Repair OS",
    slug: "auto-repair-service-scheduling-and-reviews",
    icon: Car,
    tagline: "Book more service, recover missed calls, and stack five-star reviews.",
    includes: ["Service scheduling agent", "Missed-call recovery", "Quote & status follow-up", "Review engine"],
    savings: "~$6,000/mo",
    basePrice: 2600,
    baseSavings: 6000,
    vertical: "Auto repair",
  },
  {
    name: "Insurance & Advisor OS",
    slug: "insurance-agency-lead-qualification-and-renewals",
    icon: Umbrella,
    tagline: "Qualify every lead, chase every renewal, collect every document.",
    includes: ["Lead qualification agent", "Renewal chasing", "Document collection", "Meeting scheduler"],
    savings: "~$6,500/mo",
    basePrice: 2600,
    baseSavings: 6500,
    vertical: "Insurance",
  },
  {
    name: "Property Management OS",
    slug: "property-management-maintenance-and-tenant-comms",
    icon: Building2,
    tagline: "Triage maintenance, answer tenants, and fill vacancies faster.",
    includes: ["Maintenance triage agent", "Tenant Q&A + rent reminders", "Lead-to-lease follow-up", "Review requests"],
    savings: "~$4,600/mo",
    basePrice: 2200,
    baseSavings: 4600,
    vertical: "Property management",
  },
];

export type Addon = {
  id: string;
  name: string;
  icon: LucideIcon;
  price: number;
  savings: number;
  desc: string;
};

/** A la carte agents that attach to any OS — the configurable moat. */
export const addons: Addon[] = [
  { id: "voice", name: "AI Voice Receptionist", icon: Phone, price: 800, savings: 3000, desc: "24/7 phone agent that answers, qualifies, and books." },
  { id: "whatsapp", name: "Multilingual WhatsApp Agent", icon: MessageCircle, price: 600, savings: 2400, desc: "Sell, book, and support over WhatsApp in any language." },
  { id: "reviews", name: "Review & Reputation Engine", icon: Star, price: 400, savings: 1200, desc: "Ask happy customers for reviews and auto-reply to all." },
  { id: "sdr", name: "AI Sales Follow-up (SDR)", icon: TrendingUp, price: 700, savings: 3500, desc: "Enrich, nurture, and book meetings from every lead." },
  { id: "finance", name: "Finance & Back-Office", icon: Receipt, price: 600, savings: 2000, desc: "Invoices, AP/AR, dunning, and month-end prep." },
  { id: "custom", name: "Custom Workflow Agent", icon: Bot, price: 500, savings: 1500, desc: "A bespoke agent for whatever else eats your day." },
];
