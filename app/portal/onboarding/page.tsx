import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSupabaseAuthConfigured, getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { ensureClientProvisioned } from "@/lib/provisioning";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("prt.onboardingMetaTitle"),
    robots: { index: false, follow: false },
  };
}

const EMPTY = { industry: "", hours: "", services: "", pricing: "", faq: "", tone: "" };

export default async function OnboardingPage() {
  if (!isSupabaseAuthConfigured()) redirect("/portal");
  const email = await getPortalUserEmail();
  if (!email) redirect("/portal/login");

  await ensureClientProvisioned(email);

  let initial = EMPTY;
  const svc = getServiceClient();
  if (svc) {
    const { data: client } = await svc.from("clients").select("id").eq("email", email.toLowerCase()).maybeSingle();
    if (client) {
      const { data: p } = await svc
        .from("business_profile")
        .select("industry, hours, services, pricing, faq, tone")
        .eq("client_id", client.id)
        .maybeSingle();
      if (p) {
        initial = {
          industry: p.industry ?? "",
          hours: p.hours ?? "",
          services: p.services ?? "",
          pricing: p.pricing ?? "",
          faq: p.faq ?? "",
          tone: p.tone ?? "",
        };
      }
    }
  }

  return <OnboardingWizard initial={initial} />;
}
