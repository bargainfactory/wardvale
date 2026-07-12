import { PortalDashboard } from "@/components/portal-dashboard";
import { isSupabaseAuthConfigured, getPortalUserEmail } from "@/lib/supabase-ssr";
import { getPortalData, type PortalData } from "@/lib/portal";
import { ensureClientProvisioned } from "@/lib/provisioning";
import { loadPeerBenchmarks, type PeerBenchmarks } from "@/lib/peer-benchmarks";

// Demo shown to visitors and any signed-in client without live data yet.
const DEMO: PortalData & { deltas: { runs: string; hours: string; success: string; roi: string } } = {
  clientName: "Nona Bistro",
  onboarded: true,
  plan: "growth",
  agentConfigs: [
    { key: "inbox-triage", name: "Inbox triage", enabled: true, autoSend: false, schedule: "hourly" },
    { key: "review-request", name: "Review requests", enabled: true, autoSend: false, schedule: "daily" },
    { key: "lead-qualification", name: "Lead follow-up", enabled: true, autoSend: false, schedule: "hourly" },
    { key: "cart-recovery", name: "Cart recovery", enabled: false, autoSend: false, schedule: "manual" },
    { key: "ar-followup", name: "AR follow-up", enabled: false, autoSend: false, schedule: "manual" },
    { key: "support-triage", name: "Support triage", enabled: false, autoSend: false, schedule: "manual" },
  ],
  kpis: { runs: "18,490", hours: "147h", success: "99.1%", roi: "$12,510" },
  deltas: { runs: "+23%", hours: "+18h", success: "+0.2%", roi: "+$2.1k" },
  roi: { realized: 12510, pipeline: 4820, won: 143, resolved: 190, winRate: 75 },
  roiProof: { monthlyCost: 2000, realized: 12510, multiple: 6.3, remaining: 0, met: true, daysActive: 34, guaranteeDays: 21 },
  policy: { dailySpendCap: 500, requireApprovalOver: 250, allowedDomains: "" },
  outcomes: [
    { id: "o1", agent: "AR follow-up agent", kind: "ar-followup", value: 2400, status: "pending", detail: "Reminder: Invoice 1043 · $2,400 · 21d overdue", createdAt: "12m ago" },
    { id: "o2", agent: "Cart recovery agent", kind: "cart-recovery", value: 128, status: "won", detail: "Recovered cart · Ana Lee", createdAt: "1h ago" },
    { id: "o3", agent: "Review request agent", kind: "review-request", value: 40, status: "pending", detail: "Review ask · Dana R.", createdAt: "2h ago" },
    { id: "o4", agent: "Lead qualification agent", kind: "lead-qualification", value: 250, status: "won", detail: "Booked · Frank T. (Website form)", createdAt: "Yesterday" },
  ],
  automations: [
    { id: "a1", name: "Inbox triage agent", status: "active", runs: 12847, successRate: 99.3, saved: 4280, lastRun: "34s ago" },
    { id: "a2", name: "Lead qualifier", status: "active", runs: 3182, successRate: 98.7, saved: 2140, lastRun: "2m ago" },
    { id: "a3", name: "Review response bot", status: "active", runs: 847, successRate: 99.8, saved: 620, lastRun: "8m ago" },
    { id: "a4", name: "Cart recovery flow", status: "paused", runs: 521, successRate: 97.4, saved: 1870, lastRun: "1h ago" },
    { id: "a5", name: "Booking after-hours agent", status: "active", runs: 1093, successRate: 99.1, saved: 3600, lastRun: "just now" },
  ],
  logs: [
    { time: "11:42 AM", event: "Lead qualified — scored 87/100 → HubSpot", type: "success" },
    { time: "11:38 AM", event: 'Email drafted re: "Catering inquiry" — pending review', type: "info" },
    { time: "11:35 AM", event: "Missed call → SMS follow-up sent + Calendly link", type: "success" },
    { time: "11:22 AM", event: "Google review reply published (5★)", type: "success" },
    { time: "11:10 AM", event: "Cart recovery: $89 order recovered via email #2", type: "success" },
    { time: "10:58 AM", event: "Onboarding: Contract signed → portal invite sent", type: "success" },
  ],
  connections: [
    { provider: "Gmail", status: "connected", scope: "read + draft (no send without approval)" },
    { provider: "Calendly", status: "connected", scope: "read + create events" },
    { provider: "HubSpot", status: "connected", scope: "read + write contacts" },
    { provider: "Twilio SMS", status: "connected", scope: "send SMS" },
    { provider: "Stripe", status: "error", scope: "read charges — reauth needed", health: "error", reconnectHref: "/connections" },
  ],
  audit: [
    { time: "11:40 AM", actor: "marco@nonabistro.com", action: "agent.paused", detail: "Cart recovery flow" },
    { time: "10:12 AM", actor: "system", action: "approval.sent", detail: "Draft reply to Catering inquiry" },
    { time: "09:58 AM", actor: "flowforge", action: "config.updated", detail: "Inbox triage agent — added VIP rule" },
    { time: "Yesterday", actor: "marco@nonabistro.com", action: "connection.added", detail: "Twilio SMS (send)" },
    { time: "Yesterday", actor: "system", action: "guardrail.blocked", detail: "Outbound to unverified domain" },
  ],
  approvals: [
    { id: "p1", agent: "Inbox triage agent", action: "email.send", summary: "Reply to catering inquiry from Priya (party of 40)", createdAt: "2m ago" },
    { id: "p2", agent: "Review response bot", action: "review.reply", summary: "Public reply to a 3★ Google review", createdAt: "18m ago" },
    { id: "p3", agent: "Cart recovery flow", action: "discount.issue", summary: "Send a 10% code to recover a $240 cart", createdAt: "1h ago" },
  ],
};

const DEMO_BENCHMARKS: PeerBenchmarks = {
  industry: "Restaurant / hospitality",
  sampleSize: 24,
  metrics: [
    { label: "Win rate", you: 75, peers: 61, unit: "%" },
    { label: "Realized value", you: 12510, peers: 8900, unit: "$" },
  ],
};

export default async function PortalPage() {
  const authEnabled = isSupabaseAuthConfigured();
  let userEmail: string | null = null;
  let data: PortalData | null = null;
  let benchmarks: PeerBenchmarks | null = null;

  if (authEnabled) {
    userEmail = await getPortalUserEmail();
    if (userEmail) {
      // Turnkey: a signed-in user with no client yet is provisioned on the spot
      // (trial), so sign-up → live portal with zero manual setup.
      data = await getPortalData(userEmail);
      if (!data) {
        await ensureClientProvisioned(userEmail);
        data = await getPortalData(userEmail);
      }
      if (data) benchmarks = await loadPeerBenchmarks(userEmail);
    }
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
      connections={view.connections}
      audit={view.audit}
      approvals={view.approvals}
      onboarded={view.onboarded}
      plan={view.plan}
      agentConfigs={view.agentConfigs}
      roi={view.roi}
      roiProof={view.roiProof}
      outcomes={view.outcomes}
      benchmarks={isDemo ? DEMO_BENCHMARKS : benchmarks}
      policy={view.policy}
      isDemo={isDemo}
      authEnabled={authEnabled}
      userEmail={userEmail}
    />
  );
}
