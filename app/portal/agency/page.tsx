import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSupabaseAuthConfigured, getPortalUserEmail } from "@/lib/supabase-ssr";
import { getAgencyFor, listAgencyClients, type AgencyClient } from "@/lib/agency";
import { AgencyConsole } from "@/components/agency-console";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("prt.agencyMetaTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function AgencyPage() {
  if (!isSupabaseAuthConfigured()) redirect("/portal");
  const email = await getPortalUserEmail();
  if (!email) redirect("/portal/login");

  const agency = await getAgencyFor(email);
  let clients: AgencyClient[] = [];
  if (agency) clients = await listAgencyClients(agency.id);

  return <AgencyConsole agency={agency} clients={clients} />;
}
