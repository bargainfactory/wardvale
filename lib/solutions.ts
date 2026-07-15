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
    name: "sol.bundleRestaurantName",
    slug: "restaurant-reservation-and-review-agent",
    icon: Utensils,
    tagline: "sol.bundleRestaurantTagline",
    includes: ["sol.incReservationReviewAgent", "sol.incWhatsappBookingAgent", "sol.incInboxDmTriage", "sol.incNoShowReminders"],
    savings: "sol.savings3400",
    basePrice: 1800,
    baseSavings: 3400,
    vertical: "Restaurant",
  },
  {
    name: "sol.bundleHomeServicesName",
    slug: "ai-phone-agent-for-home-services",
    icon: Wrench,
    tagline: "sol.bundleHomeServicesTagline",
    includes: ["sol.incAiPhoneAnsweringAgent", "sol.incMissedCallBookedJob", "sol.incQuoteFollowup", "sol.incReviewRequests"],
    savings: "sol.savings4800",
    basePrice: 2200,
    baseSavings: 4800,
    vertical: "Home services",
  },
  {
    name: "sol.bundleDentalName",
    slug: "ai-voice-receptionist-for-dental-practices",
    icon: Stethoscope,
    tagline: "sol.bundleDentalTagline",
    includes: ["sol.incAiVoiceReceptionist", "sol.incAppointmentReminders", "sol.incRebookingRecalls", "sol.incIntakeAutomation"],
    savings: "sol.savings5200",
    basePrice: 2600,
    baseSavings: 5200,
    vertical: "Dental",
  },
  {
    name: "sol.bundleRealEstateName",
    slug: "real-estate-lead-qualification-and-follow-up",
    icon: Building2,
    tagline: "sol.bundleRealEstateTagline",
    includes: ["sol.incLeadQualAgent", "sol.incMultiTouchFollowup", "sol.incWhatsappSmsAgent", "sol.incShowingScheduler"],
    savings: "sol.savings5600",
    basePrice: 2400,
    baseSavings: 5600,
    vertical: "Real estate",
  },
  {
    name: "sol.bundleLawFirmName",
    slug: "ai-voice-agent-for-law-firms",
    icon: Scale,
    tagline: "sol.bundleLawFirmTagline",
    includes: ["sol.incAiIntakeCallAgent", "sol.incConflictIntakeQuestions", "sol.incDocCollection", "sol.incConsultScheduling"],
    savings: "sol.savings4200",
    basePrice: 2200,
    baseSavings: 4200,
    vertical: "Law firm",
  },
  {
    name: "sol.bundleEcommerceName",
    slug: "shopify-store-abandoned-cart-recovery",
    icon: ShoppingBag,
    tagline: "sol.bundleEcommerceTagline",
    includes: ["sol.incAbandonedCartRecovery", "sol.incWhatsappSalesSupport", "sol.incSupportInboxTriage", "sol.incReviewEngine"],
    savings: "sol.savings7200",
    basePrice: 2800,
    baseSavings: 7200,
    vertical: "E-commerce",
  },
  {
    name: "sol.bundleMedSpaName",
    slug: "med-spa-booking-and-rebooking-agent",
    icon: HeartPulse,
    tagline: "sol.bundleMedSpaTagline",
    includes: ["sol.incBookingConsultAgent", "sol.incCancellationFillWaitlist", "sol.incRebookingRecalls", "sol.incReviewRequests"],
    savings: "sol.savings5000",
    basePrice: 2400,
    baseSavings: 5000,
    vertical: "Med spa",
  },
  {
    name: "sol.bundleVeterinaryName",
    slug: "veterinary-appointment-reminders-and-recalls",
    icon: PawPrint,
    tagline: "sol.bundleVeterinaryTagline",
    includes: ["sol.incAppointmentReminders", "sol.incVaccineWellnessRecalls", "sol.incAfterHoursTriage", "sol.incReviewRequests"],
    savings: "sol.savings4400",
    basePrice: 2200,
    baseSavings: 4400,
    vertical: "Veterinary",
  },
  {
    name: "sol.bundleFitnessName",
    slug: "gym-fitness-membership-onboarding-and-winback",
    icon: Dumbbell,
    tagline: "sol.bundleFitnessTagline",
    includes: ["sol.incTrialToMemberNurture", "sol.incClassBookingAgent", "sol.incNoShowWinback", "sol.incMembershipOnboarding"],
    savings: "sol.savings3600",
    basePrice: 1800,
    baseSavings: 3600,
    vertical: "Fitness",
  },
  {
    name: "sol.bundleAutoName",
    slug: "auto-repair-service-scheduling-and-reviews",
    icon: Car,
    tagline: "sol.bundleAutoTagline",
    includes: ["sol.incServiceSchedulingAgent", "sol.incMissedCallRecovery", "sol.incQuoteStatusFollowup", "sol.incReviewEngine"],
    savings: "sol.savings6000",
    basePrice: 2600,
    baseSavings: 6000,
    vertical: "Auto repair",
  },
  {
    name: "sol.bundleInsuranceName",
    slug: "insurance-agency-lead-qualification-and-renewals",
    icon: Umbrella,
    tagline: "sol.bundleInsuranceTagline",
    includes: ["sol.incLeadQualAgent", "sol.incRenewalChasing", "sol.incDocCollection", "sol.incMeetingScheduler"],
    savings: "sol.savings6500",
    basePrice: 2600,
    baseSavings: 6500,
    vertical: "Insurance",
  },
  {
    name: "sol.bundlePropertyName",
    slug: "property-management-maintenance-and-tenant-comms",
    icon: Building2,
    tagline: "sol.bundlePropertyTagline",
    includes: ["sol.incMaintenanceTriageAgent", "sol.incTenantQaRentReminders", "sol.incLeadToLeaseFollowup", "sol.incReviewRequests"],
    savings: "sol.savings4600",
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
  { id: "voice", name: "sol.addonVoiceName", icon: Phone, price: 800, savings: 3000, desc: "sol.addonVoiceDesc" },
  { id: "whatsapp", name: "sol.addonWhatsappName", icon: MessageCircle, price: 600, savings: 2400, desc: "sol.addonWhatsappDesc" },
  { id: "reviews", name: "sol.addonReviewsName", icon: Star, price: 400, savings: 1200, desc: "sol.addonReviewsDesc" },
  { id: "sdr", name: "sol.addonSdrName", icon: TrendingUp, price: 700, savings: 3500, desc: "sol.addonSdrDesc" },
  { id: "finance", name: "sol.addonFinanceName", icon: Receipt, price: 600, savings: 2000, desc: "sol.addonFinanceDesc" },
  { id: "custom", name: "sol.addonCustomName", icon: Bot, price: 500, savings: 1500, desc: "sol.addonCustomDesc" },
];
