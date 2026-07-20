import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSupabaseAuthConfigured, getPortalUserEmail } from "@/lib/supabase-ssr";
import { getServiceClient } from "@/lib/supabase-server";
import { ensureClientProvisioned } from "@/lib/provisioning";
import { planOf } from "@/lib/agents-catalog";
import { AgentDesignStudio } from "@/components/agent-design-studio";
import { getT } from "@/lib/i18n-server";
import type { StudioIntake } from "@/lib/studio-generator";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("studio.metaTitle"), robots: { index: false, follow: false } };
}

export default async function StudioPage() {
  if (!isSupabaseAuthConfigured()) redirect("/portal");
  const email = await getPortalUserEmail();
  if (!email) redirect("/portal/login");

  await ensureClientProvisioned(email);

  const { locale } = await getT();
  let intake: StudioIntake = { version: 1 };
  let plan = "trial";

  const svc = getServiceClient();
  if (svc) {
    const { data: client } = await svc
      .from("clients")
      .select("id, plan")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (client) {
      plan = (client as { plan?: string }).plan ?? "trial";
      const { data: p } = await svc
        .from("business_profile")
        .select("intake, industry, hours, services, pricing, faq, tone")
        .eq("client_id", client.id)
        .maybeSingle();
      const stored = (p?.intake ?? {}) as StudioIntake;
      // Rehydrate saved answers; if none yet, seed the context from any facts the
      // old wizard already captured so the client isn't retyping them.
      intake =
        stored && Object.keys(stored).length > 1
          ? { ...stored, version: 1 }
          : {
              version: 1,
              context: {
                industry: p?.industry ?? "",
                hours: p?.hours ?? "",
                services: p?.services ?? "",
                pricing: p?.pricing ?? "",
                faq: p?.faq ?? "",
                tone: p?.tone ?? "",
              },
            };
    }
  }

  return <AgentDesignStudio initial={intake} plan={planOf(plan)} locale={locale} />;
}
