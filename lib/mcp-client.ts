import https from "node:https";
import dns from "node:dns/promises";
import net from "node:net";
import { createHash } from "node:crypto";
import { validateArgs, type MCPSchema } from "@/lib/mcp";
import { fenceUntrusted, detectInjection } from "@/lib/guardrails";

// ── Guarded outbound tool client (BYOT) ──────────────────────────────────────
// FlowForge is normally an MCP *server*; this is the ONLY place it acts as a
// client, calling a customer-supplied MCP server / HTTPS endpoint. Every call is
// hardened against SSRF (connect-time IP validation, HTTPS-only, no redirects),
// DoS (timeout + size cap), and prompt-injection (output fenced + flagged). The
// bearer token is sent only to the validated origin and never logged.

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 256_000;
export const MAX_TOOLS = 50;
export const MAX_SCHEMA_BYTES = 32_000;
const PROTOCOL_VERSION = "2024-11-05";

export class ToolClientError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "ToolClientError";
  }
}

export type ToolDef = { name: string; description?: string; inputSchema?: MCPSchema };
export type ToolResult = { text: string; flagged: boolean; reason?: string };

// ── SSRF guards (pure, exported for tests) ───────────────────────────────────

/** Convert an IPv4 dotted string to a 32-bit integer, or null. */
function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}

function v4Blocked(ip: string): boolean {
  const n = v4ToInt(ip);
  if (n === null) return true; // unparseable → treat as unsafe
  const inRange = (base: string, bits: number) => {
    const b = v4ToInt(base)!;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (b & mask);
  };
  return (
    inRange("0.0.0.0", 8) || // "this" network
    inRange("10.0.0.0", 8) || // private
    inRange("100.64.0.0", 10) || // CGNAT (incl. Alibaba 100.100.x metadata)
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local + cloud metadata (169.254.169.254)
    inRange("172.16.0.0", 12) || // private
    inRange("192.0.0.0", 24) ||
    inRange("192.0.2.0", 24) ||
    inRange("192.168.0.0", 16) || // private
    inRange("198.18.0.0", 15) ||
    inRange("198.51.100.0", 24) ||
    inRange("203.0.113.0", 24) ||
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserved/broadcast
  );
}

/** True if an IP literal (v4 or v6) is in a range agents must never reach. */
export function isBlockedIp(ip: string): boolean {
  const addr = ip.trim().replace(/^\[|\]$/g, "");
  if (net.isIPv4(addr)) return v4Blocked(addr);
  if (net.isIPv6(addr)) {
    const lower = addr.toLowerCase();
    // IPv4-mapped/compat (::ffff:a.b.c.d) → validate the embedded v4.
    const mapped = lower.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return v4Blocked(mapped[1]);
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    const head = lower.split(":")[0];
    const h = parseInt(head || "0", 16);
    if (Number.isNaN(h)) return true;
    if ((h & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local (incl. AWS v6 IMDS)
    if ((h & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((h & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    return false;
  }
  return true; // not a valid IP → unsafe
}

/** Throw unless `urlStr` is a plain public HTTPS URL (no userinfo, port 443). */
export function assertPublicHttpsUrl(urlStr: string): URL {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new ToolClientError("bad_url", "Endpoint must be a valid URL.");
  }
  if (url.protocol !== "https:") throw new ToolClientError("insecure", "Endpoint must use https://.");
  if (url.username || url.password) throw new ToolClientError("bad_url", "Endpoint must not contain credentials.");
  if (url.port && url.port !== "443") throw new ToolClientError("bad_port", "Endpoint must use the default HTTPS port.");
  // If the host is an IP literal, validate it now; hostnames are validated at
  // connect time against their resolved address (below).
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if ((net.isIP(host) !== 0) && isBlockedIp(host)) {
    throw new ToolClientError("ssrf_blocked", "Endpoint resolves to a private address.");
  }
  return url;
}

/** Reject if ANY resolved address is blocked (a public host that also maps to a
 * private IP is a rebinding attempt). Exported for tests. */
export function assertResolvedSafe(addresses: { address: string }[]): void {
  if (!addresses.length) throw new ToolClientError("dns_fail", "Endpoint did not resolve.");
  for (const a of addresses) {
    if (isBlockedIp(a.address)) throw new ToolClientError("ssrf_blocked", "Endpoint resolves to a private address.");
  }
}

// ── Guarded request ──────────────────────────────────────────────────────────

type LookupAll = (host: string) => Promise<{ address: string; family: number }[]>;
const defaultLookup: LookupAll = (host) => dns.lookup(host, { all: true, verbatim: true });

/**
 * POST JSON to a customer endpoint with all guards applied. `_lookup` is
 * injectable for tests (defaults to DNS). Returns parsed JSON or throws a typed
 * ToolClientError. The bearer token is never logged and rides only this request.
 */
async function guardedPost(
  urlStr: string,
  token: string | null,
  payload: unknown,
  _lookup: LookupAll = defaultLookup
): Promise<unknown> {
  const url = assertPublicHttpsUrl(urlStr);

  // Resolve ONCE, validate every address, then pin the connection to a validated
  // IP so there is no second (rebindable) resolution.
  const addresses = await _lookup(url.hostname).catch(() => {
    throw new ToolClientError("dns_fail", "Could not resolve endpoint.");
  });
  assertResolvedSafe(addresses);
  const pinned = addresses[0];

  const bodyStr = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    "content-length": String(Buffer.byteLength(bodyStr)),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        servername: url.hostname, // SNI
        headers,
        // Pin to the pre-validated address; the socket cannot re-resolve to a
        // different (private) IP between validation and connect.
        lookup: (_host: string, _opts: unknown, cb: (e: Error | null, a: string, f: number) => void) =>
          cb(null, pinned.address, pinned.family),
      },
      (res) => {
        // Never auto-follow redirects — a 3xx to an internal host is an SSRF vector.
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
          res.destroy();
          reject(new ToolClientError("redirect_refused", "Endpoint attempted a redirect."));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new ToolClientError("too_large", "Endpoint response was too large."));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new ToolClientError("remote_error", `Endpoint returned ${res.statusCode ?? "no status"}.`));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new ToolClientError("bad_response", "Endpoint did not return valid JSON."));
          }
        });
      }
    );
    req.on("error", () => reject(new ToolClientError("network", "Could not reach endpoint.")));
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new ToolClientError("timeout", "Endpoint took too long to respond."));
    });
    req.end(bodyStr);
  });
}

// ── JSON-RPC helpers ─────────────────────────────────────────────────────────

function rpcResult(res: unknown): Record<string, unknown> {
  const r = res as { error?: { message?: string }; result?: Record<string, unknown> };
  if (r?.error) throw new ToolClientError("remote_error", "The tool returned an error.");
  return r?.result ?? {};
}

/** Extract text from an MCP tools/call result, fence it, and flag injection.
 * Exported for tests — pure, no network. */
export function toToolResult(result: Record<string, unknown>): ToolResult {
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content
    .map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text?: unknown }).text ?? "") : ""))
    .join("\n")
    .trim();
  const injection = detectInjection(text);
  return { text: fenceUntrusted(text), flagged: injection.flagged, reason: injection.reason };
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Discover a remote MCP server's tools (initialize → tools/list). Caps count + schema size. */
export async function mcpListTools(endpoint: string, token: string | null): Promise<ToolDef[]> {
  await guardedPost(endpoint, token, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "flowforge-ai", version: "1.0.0" } },
  });
  const listed = rpcResult(await guardedPost(endpoint, token, { jsonrpc: "2.0", id: 2, method: "tools/list" }));
  const raw = Array.isArray(listed.tools) ? listed.tools : [];
  return raw.slice(0, MAX_TOOLS).map((t) => {
    const d = t as { name?: unknown; description?: unknown; inputSchema?: unknown };
    const schema = d.inputSchema;
    const schemaOk = schema && JSON.stringify(schema).length <= MAX_SCHEMA_BYTES ? (schema as MCPSchema) : undefined;
    return { name: String(d.name ?? ""), description: d.description ? String(d.description).slice(0, 500) : undefined, inputSchema: schemaOk };
  });
}

/** Call a tool on a remote MCP server (validates args against the cached schema first). */
export async function mcpCallTool(
  endpoint: string,
  token: string | null,
  name: string,
  args: Record<string, unknown>,
  schema?: MCPSchema
): Promise<ToolResult> {
  if (schema) {
    const invalid = validateArgs(schema, args);
    if (invalid) throw new ToolClientError("bad_args", invalid);
  }
  const res = rpcResult(
    await guardedPost(endpoint, token, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name, arguments: args } })
  );
  return toToolResult(res);
}

/** Call a single custom HTTPS endpoint (args as the JSON body). */
export async function httpCallTool(
  endpoint: string,
  token: string | null,
  args: Record<string, unknown>,
  schema?: MCPSchema
): Promise<ToolResult> {
  if (schema) {
    const invalid = validateArgs(schema, args);
    if (invalid) throw new ToolClientError("bad_args", invalid);
  }
  const res = await guardedPost(endpoint, token, args);
  const text = typeof res === "string" ? res : JSON.stringify(res);
  const injection = detectInjection(text);
  return { text: fenceUntrusted(text.slice(0, MAX_BYTES)), flagged: injection.flagged, reason: injection.reason };
}

/** sha256 of the cached tool catalog, for drift detection. */
export function hashToolsCache(tools: ToolDef[]): string {
  return createHash("sha256").update(JSON.stringify(tools)).digest("hex");
}
