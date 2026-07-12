import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSupabaseAuthConfigured, getPortalUserEmail } from "@/lib/supabase-ssr";
import { getAgencyFor, listAgencyClients, type AgencyClient } from "@/lib/agency";
import { AgencyConsole } from "@/components/agency-console";

export const metadata: Metadata = {
  title: "Agency console — FlowForge AI",
  robots: { index: false, follow: false },
};

export default async function AgencyPage() {
  if (!isSupabaseAuthConfigured()) redirect("/portal");
  const email = await getPortalUserEmail();
  if (!email) redirect("/portal/login");

  const agency = await getAgencyFor(email);
  let clients: AgencyClient[] = [];
  if (agency) clients = await listAgencyClients(agency.id);

  return <AgencyConsole agency={agency} clients={clients} />;
}
