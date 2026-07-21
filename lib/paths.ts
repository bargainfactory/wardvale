/**
 * Sanitize a caller-supplied redirect target down to a same-origin path.
 * Anything that could escape the origin — protocol-relative "//evil.com",
 * absolute URLs, backslash tricks ("/\evil.com" normalizes to "//"), or
 * header-injection newlines — falls back. Used by the auth callback and the
 * login page so a crafted `next` param can never bounce a client off-site.
 */
export function safeInternalPath(raw: string | null | undefined, fallback = "/portal"): string {
  if (!raw) return fallback;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (path.includes("\\") || /[\r\n]/.test(path)) return fallback;
  return path;
}
