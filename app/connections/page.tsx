import type { Metadata } from "next";
import { ArrowRight, Check, Lock, Plug, ShieldCheck } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { connectors, isConnectorConfigured, type Connector } from "@/lib/connectors";

export const metadata: Metadata = {
  title: "Connections — Link QuickBooks, Xero, Workday & More",
  description:
    "Connect your accounting, HR, CRM, and productivity tools (QuickBooks, Xero, Workday, HubSpot, Slack, Google, Calendly) so FlowForge agents can automate tasks end-to-end — with least-privilege scopes and human approval.",
  alternates: { canonical: "/connections" },
};

const CATEGORY_ORDER = ["Accounting", "HR & Payroll", "CRM", "Comms", "Scheduling", "Productivity"] as const;

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: connectors.filter((c) => c.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <PageLayout>
      <section className="relative overflow-hidden pb-10 pt-4">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-mesh-dark" />
        <div className="container relative">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">Connections</span>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Connect your stack. <span className="gradient-text">Automate end to end.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Link your accounting, HR, CRM, and productivity tools with least-privilege access. Agents act
              through them — and every outbound action waits for your approval.
            </p>
          </div>

          {sp.connected && (
            <div className="mx-auto mt-6 flex max-w-md items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
              <Check className="h-4 w-4" /> Connected <b>{sp.connected}</b>. Your agents can now act through it.
            </div>
          )}
          {sp.error && (
            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-center text-sm text-yellow-200">
              {sp.error === "notconfigured"
                ? `${sp.p ?? "That connector"} isn't switched on yet — it needs its OAuth app configured.`
                : "Couldn't complete the connection. Please try again."}
            </div>
          )}
        </div>
      </section>

      <section className="pb-20">
        <div className="container space-y-12">
          {grouped.map((group) => (
            <div key={group.category}>
              <h2 className="mb-4 font-display text-lg font-semibold text-muted-foreground">{group.category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((c) => (
                  <ConnectorCard key={c.id} connector={c} ready={isConnectorConfigured(c)} />
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-border bg-card/40 p-5 text-sm text-muted-foreground">
            <ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-300" />
            Every connection uses least-privilege scopes, tokens are stored encrypted and never leave the
            server, and any action an agent takes through a connection is queued for your approval and
            written to the audit log. Revoke access anytime from the tool&rsquo;s own settings.
          </div>
        </div>
      </section>
    </PageLayout>
  );
}

function ConnectorCard({ connector, ready }: { connector: Connector; ready: boolean }) {
  return (
    <div className="flex flex-col rounded-3xl glass p-6">
      <div className="flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric/25 to-indigo-500/15 text-cyan-electric">
          <Plug className="h-5 w-5" />
        </span>
        {ready ? (
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            Ready
          </span>
        ) : (
          <span className="rounded-full border border-border bg-card/50 px-2.5 py-1 text-[11px] text-muted-foreground">
            Setup needed
          </span>
        )}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{connector.name}</h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{connector.blurb}</p>
      <div className="mt-5">
        {ready ? (
          <a href={`/api/connect/${connector.id}/start`}>
            <Button size="sm" className="w-full">
              Connect {connector.name} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </a>
        ) : (
          <Button size="sm" variant="outline" className="w-full" disabled>
            <Lock className="h-3.5 w-3.5" /> Awaiting OAuth setup
          </Button>
        )}
      </div>
    </div>
  );
}
