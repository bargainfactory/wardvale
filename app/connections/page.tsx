import type { Metadata } from "next";
import { ArrowRight, Check, Lock, Plug, ShieldCheck } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n-server";
import { connectors, isConnectorConfigured, type Category, type Connector } from "@/lib/connectors";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("conn.metaTitle"),
    description: t("conn.metaDesc"),
    alternates: { canonical: "/connections" },
  };
}

const CATEGORY_ORDER = [
  "Accounting",
  "Payments",
  "HR & Payroll",
  "CRM",
  "Comms",
  "Support",
  "Marketing",
  "E-commerce",
  "Field Service",
  "Legal",
  "Scheduling",
  "Productivity",
] as const;

// Map each category to its i18n key. The literal category values above are kept
// for filtering/matching; only the displayed heading is localized.
const CATEGORY_LABEL_KEY: Record<Category, string> = {
  Accounting: "conn.catAccounting",
  Payments: "conn.catPayments",
  "HR & Payroll": "conn.catHrPayroll",
  CRM: "conn.catCrm",
  Comms: "conn.catComms",
  Support: "conn.catSupport",
  Marketing: "conn.catMarketing",
  "E-commerce": "conn.catEcommerce",
  "Field Service": "conn.catFieldService",
  Legal: "conn.catLegal",
  Scheduling: "conn.catScheduling",
  Productivity: "conn.catProductivity",
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const { t } = await getT();
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
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">{t("conn.eyebrow")}</span>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {t("conn.heroTitle1")} <span className="gradient-text">{t("conn.heroTitle2")}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              {t("conn.heroSub")}
            </p>
          </div>

          {sp.connected && (
            <div className="mx-auto mt-6 flex max-w-md items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
              <Check className="h-4 w-4" /> {t("conn.connected")} <b>{sp.connected}</b>. {t("conn.connectedDone")}
            </div>
          )}
          {sp.error && (
            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-center text-sm text-yellow-200">
              {sp.error === "notconfigured"
                ? `${sp.p ?? t("conn.thatConnector")} ${t("conn.errNotConfigured")}`
                : sp.error === "key"
                  ? t("conn.errKey")
                  : t("conn.errGeneric")}
            </div>
          )}
        </div>
      </section>

      <section className="pb-20">
        <div className="container space-y-12">
          {grouped.map((group) => (
            <div key={group.category}>
              <h2 className="mb-4 font-display text-lg font-semibold text-muted-foreground">{t(CATEGORY_LABEL_KEY[group.category])}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((c) => (
                  <ConnectorCard key={c.id} connector={c} ready={isConnectorConfigured(c)} t={t} />
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-border bg-card/40 p-5 text-sm text-muted-foreground">
            <ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-300" />
            {t("conn.securityNote")}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {t("conn.customAuthNote")}{" "}
            <a href="/pricing#quote" className="text-cyan-electric hover:underline">
              {t("conn.askUs")}
            </a>
            .
          </p>
        </div>
      </section>
    </PageLayout>
  );
}

function ConnectorCard({
  connector,
  ready,
  t,
}: {
  connector: Connector;
  ready: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col rounded-3xl glass p-6">
      <div className="flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-electric/25 to-indigo-500/15 text-cyan-electric">
          <Plug className="h-5 w-5" />
        </span>
        {ready ? (
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            {t("conn.ready")}
          </span>
        ) : (
          <span className="rounded-full border border-border bg-card/50 px-2.5 py-1 text-[11px] text-muted-foreground">
            {t("conn.setupNeeded")}
          </span>
        )}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{connector.name}</h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{t(connector.blurb)}</p>
      <div className="mt-5">
        {connector.tokenAuth === "apikey" ? (
          <form action={`/api/connect/${connector.id}/key`} method="post" className="space-y-2">
            {(connector.keyFields ?? [{ name: "key", label: "conn.apiKeyLabel" }]).map((f) => (
              <input
                key={f.name}
                name={f.name}
                required={f.name === "key"}
                placeholder={t(f.placeholder ?? f.label)}
                aria-label={`${connector.name} ${t(f.label)}`}
                className="w-full rounded-lg border border-border bg-card/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-cyan-electric"
              />
            ))}
            <Button size="sm" className="w-full" type="submit">
              {t("conn.connect")} {connector.name} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : ready ? (
          <a href={`/api/connect/${connector.id}/start`}>
            <Button size="sm" className="w-full">
              {t("conn.connect")} {connector.name} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </a>
        ) : (
          <Button size="sm" variant="outline" className="w-full" disabled>
            <Lock className="h-3.5 w-3.5" /> {t("conn.awaitingOauth")}
          </Button>
        )}
      </div>
    </div>
  );
}
