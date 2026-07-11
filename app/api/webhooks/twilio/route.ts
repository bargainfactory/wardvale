import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/supabase-server";
import { clientForInboundNumber } from "@/lib/integrations";
import { runSmsReply } from "@/lib/runtime";
import { loadContext } from "@/lib/context";
import { startTrace } from "@/lib/trace";

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const xml = (body: string, status = 200) =>
  new NextResponse(body, { status, headers: { "content-type": "text/xml" } });

/**
 * Validate Twilio's X-Twilio-Signature: HMAC-SHA1(authToken, url + sorted
 * concatenated POST params), base64. https://www.twilio.com/docs/usage/security
 */
function isValidSignature(url: string, params: Record<string, string>, header: string, authToken: string): boolean {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Inbound SMS/voice from Twilio. Validates the signature (when TWILIO_AUTH_TOKEN
 * is set), records the message as an event, and returns empty TwiML. This is the
 * seam where an inbound message would be handed to the triage/booking agent.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return xml(TWIML_OK);

  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = v.toString();

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const url =
      process.env.TWILIO_WEBHOOK_URL ??
      `${process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin}/api/webhooks/twilio`;
    const sig = req.headers.get("x-twilio-signature") ?? "";
    if (!sig || !isValidSignature(url, params, sig, authToken)) {
      return xml('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 403);
    }
  }

  const supabase = getServiceClient();
  if (supabase) {
    await supabase.from("events").insert({
      name: params.Body ? "inbound.sms" : "inbound.voice",
      props: { from: params.From ?? null, to: params.To ?? null, body: params.Body ?? null, sid: params.MessageSid ?? params.CallSid ?? null },
      path: "/api/webhooks/twilio",
    });

    // Inbound SMS → run the SMS-reply agent for the business that owns the "To"
    // number, and queue the drafted reply for human approval (never auto-sent).
    // On approval, the decide route sends it back through the client's Twilio.
    if (params.Body && params.From && params.To) {
      const cid = await clientForInboundNumber(params.To);
      if (cid) {
        const trace = startTrace("agent.sms-reply");
        trace.setInput(params.Body);
        const context = await loadContext(cid);
        const actions = await runSmsReply([{ from: params.From, to: params.To, body: params.Body }], trace, context);
        const draft = actions.find((a) => a.needsApproval && a.draft);
        if (draft) {
          await supabase.from("approvals").insert({
            client_id: cid,
            agent: draft.agent,
            action: draft.action,
            summary: draft.summary,
            payload: { draft: draft.draft, source: draft.source, to: draft.to ?? params.From },
          });
          await supabase.from("agent_audit").insert({
            client_id: cid,
            actor: "runtime",
            action: "agent.run",
            detail: `Inbound SMS from ${params.From} → reply queued for approval`,
          });
        }
        await trace.end();
      }
    }
  }

  // Empty TwiML acknowledges receipt; the reply is sent later, post-approval.
  return xml(TWIML_OK);
}
