import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Check, Scale, ShoppingBag, Stethoscope, Utensils, Wrench } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { GuaranteeBanner } from "@/components/guarantee";

export const metadata: Metadata = {
  title: "Industry Solutions — Done-for-You Automation Bundles",
  description:
    "Pre-built automation stacks tuned to your industry: Restaurant OS, Home-Services OS, Clinic OS, Real-Estate OS, Law-Firm OS, and E-commerce OS. Ship in 14 days.",
  alternates: { canonical: "/solutions" },
};

const bundles = [
  {
    name: "Restaurant OS",
    icon: Utensils,
    tagline: "Fill tables, protect your reputation, and win back your Sundays.",
    includes: ["Reservation & review agent", "WhatsApp booking agent", "Inbox & DM triage", "No-show reminders"],
    savings: "~$3,400/mo",
    slug: "restaurant-reservation-and-review-agent",
  },
  {
    name: "Home-Services OS",
    icon: Wrench,
    tagline: "Never miss an after-hours call — turn every ring into a booked job.",
    includes: ["AI phone answering agent", "Missed-call → booked job", "Quote follow-up", "Review requests"],
    savings: "~$4,800/mo",
    slug: "ai-phone-agent-for-home-services",
  },
  {
    name: "Clinic & Dental OS",
    icon: Stethoscope,
    tagline: "A 24/7 front desk that books, reminds, and rebooks — zero hold music.",
    includes: ["AI voice receptionist", "Appointment reminders", "Rebooking & recalls", "Intake automation"],
    savings: "~$5,200/mo",
    slug: "ai-voice-receptionist-for-dental-practices",
  },
  {
    name: "Real-Estate OS",
    icon: Building2,
    tagline: "Qualify and nurture every lead the second it lands — day or night.",
    includes: ["Lead qualification agent", "Multi-touch follow-up", "WhatsApp & SMS agent", "Showing scheduler"],
    savings: "~$5,600/mo",
    slug: "real-estate-lead-qualification-and-follow-up",
  },
  {
    name: "Law-Firm OS",
    icon: Scale,
    tagline: "Capture every new-client call and collect what you need — automatically.",
    includes: ["AI intake call agent", "Conflict & intake questions", "Document collection", "Consult scheduling"],
    savings: "~$4,200/mo",
    slug: "ai-voice-agent-for-law-firms",
  },
  {
    name: "E-commerce OS",
    icon: ShoppingBag,
    tagline: "Recover carts, answer buyers, and grow reviews on autopilot.",
    includes: ["Abandoned-cart recovery", "WhatsApp sales & support", "Support inbox triage", "Review engine"],
    savings: "~$7,200/mo",
    slug: "shopify-store-abandoned-cart-recovery",
  },
];

export default function SolutionsPage() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden pb-16 pt-4">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark" />
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">Industry solutions</span>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              A complete automation stack, <span className="gradient-text">built for your industry.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Skip the guesswork. Each OS is a pre-built bundle of the automations that move the needle in
              your vertical — deployed, monitored, and tuned to your voice in 14 days.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="container">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {bundles.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.name} className="group flex flex-col rounded-3xl glass p-7 transition hover:-translate-y-1 hover:shadow-glow">
                  <div className="flex items-center justify-between">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric/25 to-indigo-500/15 text-cyan-electric">
                      <Icon className="h-5 w-5" strokeWidth={2.25} />
                    </div>
                    <span className="rounded-full border border-cyan-electric/25 bg-cyan-electric/10 px-3 py-1 text-xs font-semibold text-cyan-electric tabular-nums">
                      {b.savings}
                    </span>
                  </div>
                  <h2 className="mt-5 font-display text-xl font-semibold">{b.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{b.tagline}</p>
                  <ul className="mt-5 flex-1 space-y-2">
                    {b.includes.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-electric" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex items-center gap-4">
                    <Link href="/build">
                      <Button size="sm">Build yours</Button>
                    </Link>
                    <Link
                      href={`/automations/${b.slug}`}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition group-hover:text-cyan-electric"
                    >
                      See the playbook <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container">
          <GuaranteeBanner />
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <h2 className="font-display text-3xl font-semibold">Don&rsquo;t see your industry?</h2>
            <p className="mt-3 text-muted-foreground">
              We build custom stacks for any vertical. Describe your workflow and we&rsquo;ll scope one live.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/build">
                <Button size="lg">
                  Build your automation <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="secondary" size="lg">
                  See pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
