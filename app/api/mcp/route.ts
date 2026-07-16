import { NextResponse } from "next/server";
import { services, tiers } from "@/lib/data";
import { dictionaries } from "@/lib/i18n";
import { seoPages } from "@/lib/seo-pages";
import { callModel } from "@/lib/model";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { validateArgs } from "@/lib/mcp";
import { startTrace } from "@/lib/trace";
import { getServiceClient } from "@/lib/supabase-server";
import { runConcierge, defaultDeps, type Lead } from "@/lib/orchestrator";
import { fenceUntrusted, SECURITY_PREAMBLE } from "@/lib/guardrails";

/**
 * FlowForge AI — Model Context Protocol (MCP) server.
 *
 * A dependency-free JSON-RPC 2.0 over HTTP endpoint implementing the MCP wire
 * protocol so AI assistants (Claude, ChatGPT) can discover and call FlowForge
 * tools at https://flowforge.ai/api/mcp.
 */

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PROTOCOL_VERSION = "2024-11-05";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, JsonValue>;
}

interface JsonRpcError {
  code: number;
  message: string;
}

interface ToolContent {
  content: { type: "text"; text: string }[];
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, JsonValue>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/** Wrap a plain string in the MCP tool-result shape. */
function text(s: string): ToolContent {
  return { content: [{ type: "text", text: s }] };
}

const TOOLS: ToolDefinition[] = [
  {
    name: "scope_automation",
    description:
      "Recommend a concrete AI automation blueprint (trigger, steps, estimated monthly savings) for a business and a workflow.",
    inputSchema: {
      type: "object",
      properties: {
        business: {
          type: "string",
          description: "The type of business, e.g. 'dental practice' or 'Shopify store'.",
        },
        workflow: {
          type: "string",
          description: "The workflow or pain point to automate, e.g. 'appointment reminders'.",
        },
      },
      required: ["business", "workflow"],
      additionalProperties: false,
    },
  },
  {
    name: "list_services",
    description: "List FlowForge's AI automation services with a short description of each.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_playbooks",
    description:
      "List FlowForge's industry automation playbooks (slug, vertical, workflow). Each maps to /automations/{slug}.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_pricing",
    description: "Return FlowForge's three monthly retainer tiers with prices and a short blurb.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "run_concierge",
    description:
      "Run FlowForge's New-Lead Concierge on a lead: qualify, route across sub-agents, and return the proposed (human-gated) actions. Gated — requires a valid client api_key.",
    inputSchema: {
      type: "object",
      properties: {
        api_key: { type: "string", description: "Your FlowForge client ingest key (required)." },
        name: { type: "string", description: "The lead's name." },
        email: { type: "string", description: "The lead's email." },
        message: { type: "string", description: "What the lead said / their inquiry." },
        order_status: { type: "string", description: "'paid' or 'overdue' if they reference an existing order." },
      },
      required: ["api_key"],
      additionalProperties: false,
    },
  },
];

// Content data fields are i18n keys; the MCP wire protocol has no locale
// context, so resolve them against the English dictionary.
const en = (key: string): string => dictionaries.en[key] ?? key;

function listServices(): ToolContent {
  const body = services
    .map((s) => `• ${en(s.title)} — ${en(s.description)}`)
    .join("\n");
  return text(`FlowForge AI services:\n\n${body}`);
}

function listPlaybooks(): ToolContent {
  const body = seoPages
    .map(
      (p) => `• ${p.slug} — ${en(p.vertical)}: ${en(p.workflow)} (/automations/${p.slug})`
    )
    .join("\n");
  return text(`FlowForge industry playbooks:\n\n${body}`);
}

function getPricing(): ToolContent {
  const body = tiers
    .map((t) => `• ${en(t.name)} — $${t.price.toLocaleString()}/mo — ${en(t.blurb)}`)
    .join("\n");
  return text(`FlowForge monthly retainer tiers:\n\n${body}`);
}

function deterministicBlueprint(business: string, workflow: string): string {
  return [
    `Automation blueprint for a ${business}: ${workflow}`,
    "",
    `Trigger: A new ${workflow} event arrives (form submission, inbound message, missed call, or scheduled check).`,
    "",
    "Steps:",
    `1. Capture the event and normalize the details into a single record.`,
    `2. A GPT agent qualifies, classifies, and drafts the right response in your brand voice.`,
    `3. Route the action automatically — book the slot, send the reply, or update your CRM.`,
    `4. Log the run, notify your team on Slack, and report the outcome.`,
    "",
    "Estimated monthly savings: $2,500–$5,000 in recovered revenue and reclaimed labor.",
    "",
    "Ready to build it? Book a scoping call at https://flowforge.ai/build",
  ].join("\n");
}

async function scopeAutomation(
  args: Record<string, JsonValue> | undefined
): Promise<ToolContent> {
  const business = typeof args?.business === "string" ? args.business : "small business";
  const workflow = typeof args?.workflow === "string" ? args.workflow : "manual workflow";

  if (!process.env.OPENAI_API_KEY) {
    return text(deterministicBlueprint(business, workflow));
  }

  try {
    const completion = await callModel({
      purpose: "chat",
      max_tokens: 400,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `${SECURITY_PREAMBLE}\n\nYou are a FlowForge AI automation architect. Given a business type and a workflow, produce a concise automation blueprint: a single Trigger, 3-4 numbered Steps, an estimated monthly savings figure, and a closing line inviting the reader to book at https://flowforge.ai/build. Keep it under 180 words, plain text, no markdown headers.`,
        },
        {
          role: "user",
          content: fenceUntrusted(`Business: ${business}\nWorkflow to automate: ${workflow}`),
        },
      ],
    });
    const out = completion.choices[0]?.message?.content?.trim();
    if (!out) return text(deterministicBlueprint(business, workflow));
    return text(out);
  } catch {
    return text(deterministicBlueprint(business, workflow));
  }
}

/**
 * Policy-aware, platform-wired tool (roadmap U6/G10): only an authenticated
 * client (valid ingest key) can trigger the concierge orchestration.
 */
async function runConciergeTool(args: Record<string, JsonValue> | undefined): Promise<ToolContent | JsonRpcError> {
  const apiKey = typeof args?.api_key === "string" ? args.api_key : "";
  if (!apiKey) return { code: -32602, message: "authentication required: provide your client api_key" };

  const supabase = getServiceClient();
  if (!supabase) {
    return text("The FlowForge platform backend isn't configured here, so gated actions can't run. (The public marketing tools remain available.)");
  }
  const { data: client } = await supabase.from("clients").select("id").eq("ingest_key", apiKey).maybeSingle();
  if (!client) return { code: -32001, message: "invalid api_key" };

  const status = args?.order_status;
  const lead: Lead = {
    name: typeof args?.name === "string" ? args.name : undefined,
    email: typeof args?.email === "string" ? args.email : undefined,
    message: typeof args?.message === "string" ? args.message : undefined,
    orderStatus: status === "overdue" ? "overdue" : status === "paid" ? "paid" : undefined,
    hasOrder: status === "overdue" || status === "paid" || undefined,
  };
  const state = await runConcierge(lead, defaultDeps);
  const lines = state.steps.map((s) => `• [${s.kind}] ${s.action} — ${s.summary}${s.draft ? `\n    "${s.draft}"` : ""}`);
  return text(`Concierge run (intent: ${state.intent}) — ${state.steps.length} proposed, human-gated action(s):\n${lines.join("\n")}`);
}

async function callTool(
  name: string,
  args: Record<string, JsonValue> | undefined
): Promise<ToolContent | JsonRpcError> {
  switch (name) {
    case "list_services":
      return listServices();
    case "list_playbooks":
      return listPlaybooks();
    case "get_pricing":
      return getPricing();
    case "scope_automation":
      return scopeAutomation(args);
    case "run_concierge":
      return runConciergeTool(args);
    default:
      return { code: -32602, message: `Unknown tool: ${name}` };
  }
}

function isJsonRpcError(value: unknown): value is JsonRpcError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value
  );
}

function ok(id: JsonRpcId | undefined, result: JsonValue | ToolContent): NextResponse {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, result },
    { headers: CORS_HEADERS }
  );
}

function fail(id: JsonRpcId | undefined, error: JsonRpcError): NextResponse {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: Request): Promise<NextResponse> {
  // Throttle per IP — tools/call can invoke OpenAI, so this caps spend/abuse.
  const rl = await rateLimit(`mcp:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Rate limit exceeded" } },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(rl.retryAfter) } }
    );
  }

  let body: JsonRpcRequest;
  try {
    body = (await req.json()) as JsonRpcRequest;
  } catch {
    return fail(null, { code: -32700, message: "Parse error" });
  }

  const { id, method, params } = body;

  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "flowforge-ai", version: "1.1.0" },
      });

    case "notifications/initialized":
      return ok(id, {});

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, { tools: TOOLS as unknown as JsonValue });

    case "tools/call": {
      const name = typeof params?.name === "string" ? params.name : "";
      const args =
        params?.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
          ? (params.arguments as Record<string, JsonValue>)
          : undefined;
      const def = TOOLS.find((d) => d.name === name);
      const invalid = def ? validateArgs(def.inputSchema, args) : null;
      // Trace each call for per-caller cost attribution (sampled by G7).
      const trace = startTrace(`mcp.${name || "unknown"}`);
      trace.flag("caller", clientIp(req));
      if (invalid) {
        trace.setStatus("invalid_args");
        await trace.end();
        return fail(id, { code: -32602, message: invalid });
      }
      const result = await callTool(name, args);
      trace.setStatus(isJsonRpcError(result) ? "tool_error" : "ok");
      await trace.end();
      if (isJsonRpcError(result)) return fail(id, result);
      return ok(id, result);
    }

    default:
      return fail(id, { code: -32601, message: "Method not found" });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
