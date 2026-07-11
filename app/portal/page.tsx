import { PortalDashboard } from "@/components/portal-dashboard";
import { isSupabaseAuthConfigured, getPortalUserEmail } from "@/lib/supabase-ssr";
import { getPortalData, type PortalData } from "@/lib/portal";

// Demo shown to visitors and any signed-in client without live data yet.
const DEMO: PortalData & { deltas: { runs: string; hours: string; success: string; roi: string } } = {
  clientName: "Nona Bistro",
  kpis: { runs: "18,490", hours: "147h", success: "99.1%", roi: "$12,510" },
  deltas: { runs: "+23%", hours: "+18h", success: "+0.2%", roi: "+$2.1k" },
  automations: [
    { name: "Inbox triage agent", status: "active", runs: 12847, successRate: 99.3, saved: 4280, lastRun: "34s ago" },
    { name: "Lead qualifier", status: "active", runs: 3182, successRate: 98.7, saved: 2140, lastRun: "2m ago" },
    { name: "Review response bot", status: "active", runs: 847, successRate: 99.8, saved: 620, lastRun: "8m ago" },
    { name: "Cart recovery flow", status: "paused", runs: 521, successRate: 97.4, saved: 1870, lastRun: "1h ago" },
    { name: "Booking after-hours agent", status: "active", runs: 1093, successRate: 99.1, saved: 3600, lastRun: "just now" },
  ],
  logs: [
    { time: "11:42 AM", event: "Lead qualified — scored 87/100 → HubSpot", type: "success" },
    { time: "11:38 AM", event: 'Email drafted re: "Catering inquiry" — pending review', type: "info" },
    { time: "11:35 AM", event: "Missed call → SMS follow-up sent + Calendly link", type: "success" },
    { time: "11:22 AM", event: "Google review reply published (5★)", type: "success" },
    { time: "11:10 AM", event: "Cart recovery: $89 order recovered via email #2", type: "success" },
    { time: "10:58 AM", event: "Onboarding: Contract signed → portal invite sent", type: "success" },
  ],
};

export default async function PortalPage() {
  const authEnabled = isSupabaseAuthConfigured();
  let userEmail: string | null = null;
  let data: PortalData | null = null;

  if (authEnabled) {
    userEmail = await getPortalUserEmail();
    if (userEmail) data = await getPortalData(userEmail);
  }

  const isDemo = !data;
  const view = data ?? DEMO;

  return (
    <PortalDashboard
      clientName={view.clientName}
      kpis={view.kpis}
      deltas={isDemo ? DEMO.deltas : undefined}
      automations={view.automations}
      logs={view.logs}
      isDemo={isDemo}
      authEnabled={authEnabled}
      userEmail={userEmail}
    />
  );
}
