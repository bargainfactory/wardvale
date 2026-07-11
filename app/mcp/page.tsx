import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "MCP Server — Connect FlowForge to your AI assistant",
  description:
    "FlowForge exposes a Model Context Protocol (MCP) endpoint so Claude, ChatGPT, and other AI assistants can scope automations, browse services and playbooks, and pull pricing directly.",
  alternates: { canonical: "/mcp" },
};

const ENDPOINT = "https://flowforge.ai/api/mcp";

const TOOLS: { name: string; description: string }[] = [
  {
    name: "scope_automation",
    description:
      "Give it a business and a workflow, and it returns a recommended automation blueprint — trigger, steps, and estimated monthly savings.",
  },
  {
    name: "list_services",
    description: "Returns FlowForge's full menu of AI automation services.",
  },
  {
    name: "list_playbooks",
    description: "Lists the industry playbooks, each mapping to /automations/{slug}.",
  },
  {
    name: "get_pricing",
    description: "Returns the three monthly retainer tiers with prices and blurbs.",
  },
];

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "flowforge": {
      "url": "${ENDPOINT}"
    }
  }
}`;

export default function McpPage() {
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
              Connect FlowForge to your <span className="gradient-text">AI assistant</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              FlowForge ships a Model Context Protocol (MCP) server. Point Claude, ChatGPT,
              or any MCP-compatible client at our endpoint and it can scope automations,
              browse our services and industry playbooks, and pull live pricing — all without
              leaving the chat.
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
                Endpoint
              </p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-navy-900/60 p-4 text-sm">
                <code className="text-cyan-electric">POST {ENDPOINT}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground">
                JSON-RPC 2.0 over HTTP. Implements the standard MCP handshake
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
            <h2 className="font-display text-2xl font-semibold">Available tools</h2>
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
            <h2 className="font-display text-2xl font-semibold">Add it to your MCP client</h2>
            <p className="mt-3 text-muted-foreground">
              Drop this into your client&apos;s MCP configuration (for example, Claude Desktop&apos;s
              config file), then restart the client. FlowForge&apos;s tools will appear
              automatically.
            </p>
            <div className="glass mt-6 rounded-2xl border border-border p-6">
              <pre className="overflow-x-auto rounded-xl bg-navy-900/60 p-4 text-sm leading-relaxed">
                <code className="text-foreground">{CONFIG_SNIPPET}</code>
              </pre>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              No API key required to browse services, playbooks, and pricing. The{" "}
              <code className="text-foreground">scope_automation</code> tool works out of the box
              and gets sharper when our AI layer is enabled.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl gradient-border glass-strong p-10 text-center">
            <h2 className="font-display text-3xl font-semibold">
              Rather have us build it?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Skip the wiring. Book a scoping call and we&apos;ll ship your first automation in days.
            </p>
            <div className="mt-6 flex justify-center">
              <Link href="/build">
                <Button size="lg">Scope my automation</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
