import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validate Twilio's X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sorted
 * concatenated POST params)). https://www.twilio.com/docs/usage/security
 */
export function twilioSignatureValid(
  url: string,
  params: Record<string, string>,
  header: string,
  authToken: string
): boolean {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The public URL Twilio is configured to call for a given path (for signatures). */
export function twilioWebhookUrl(reqUrl: string, path: string): string {
  return process.env.TWILIO_WEBHOOK_URL_BASE
    ? `${process.env.TWILIO_WEBHOOK_URL_BASE}${path}`
    : `${process.env.NEXT_PUBLIC_SITE_URL ?? new URL(reqUrl).origin}${path}`;
}
