import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    title: t("msc.mcpMetaTitle"),
    description: t("msc.mcpMetaDescription"),
    alternates: { canonical: locale === "en" ? "/mcp" : `/${locale}/mcp` },
  };
}

const ENDPOINT = "https://flowforge.ai/api/mcp";

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "flowforge": {
      "url": "${ENDPOINT}"
    }
  }
}`;

export default async function McpPage() {
  const { t } = await getT();

  const TOOLS: { name: string; description: string }[] = [
    { name: "scope_automation", description: t("msc.mcpToolScopeDesc") },
    { name: "list_services", description: t("msc.mcpToolListServicesDesc") },
    { name: "list_playbooks", description: t("msc.mcpToolListPlaybooksDesc") },
    { name: "get_pricing", description: t("msc.mcpToolGetPricingDesc") },
  ];

  return (
    <PageLayout>
      <section className="relative overflow-hidden pb-16">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-electric">
              Model Context Protocol
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {t("msc.mcpH1a")} <span className="gradient-text">{t("msc.mcpH1b")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {t("msc.mcpIntro")}
            </p>
          </div>
        </div>
      </section>

      {/* Endpoint */}
      <section className="pb-16">
        <div className="container">
          <div className="mx-auto max-w-3xl">
            <div className="glass rounded-2xl border border-border p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("msc.mcpEndpoint")}
              </p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-navy-900/60 p-4 text-sm">
                <code className="text-cyan-electric">POST {ENDPOINT}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground">
                {t("msc.mcpHandshake")}{" "}
                (<code className="text-foreground">initialize</code>,{" "}
                <code className="text-foreground">tools/list</code>,{" "}
                <code className="text-foreground">tools/call</code>).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="pb-16">
        <div className="container">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-2xl font-semibold">{t("msc.mcpAvailableTools")}</h2>
            <div className="mt-6 grid gap-4">
              {TOOLS.map((tool) => (
                <div
                  key={tool.name}
                  className="glass flex flex-col gap-1 rounded-2xl border border-border p-5 sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <code className="shrink-0 font-display text-sm font-semibold text-cyan-electric">
                    {tool.name}
                  </code>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Config snippet */}
      <section className="pb-16">
        <div className="container">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-2xl font-semibold">{t("msc.mcpAddClient")}</h2>
            <p className="mt-3 text-muted-foreground">
              {t("msc.mcpAddClientBody")}
            </p>
            <div className="glass mt-6 rounded-2xl border border-border p-6">
              <pre className="overflow-x-auto rounded-xl bg-navy-900/60 p-4 text-sm leading-relaxed">
                <code className="text-foreground">{CONFIG_SNIPPET}</code>
              </pre>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("msc.mcpNoKeyPre")}{" "}
              <code className="text-foreground">scope_automation</code>{t("msc.mcpNoKeyPost")}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <h2 className="font-display text-3xl font-semibold">
              {t("msc.mcpCtaTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("msc.mcpCtaBody")}
            </p>
            <div className="mt-6 flex justify-center">
              <Link href="/build">
                <Button size="lg">{t("msc.mcpScopeCta")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
