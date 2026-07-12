import { NextResponse } from "next/server";
import { twilioSignatureValid, twilioWebhookUrl } from "@/lib/twilio";

const xml = (body: string, status = 200) =>
  new NextResponse(body, { status, headers: { "content-type": "text/xml" } });

/**
 * Inbound Twilio Voice call. Greets the caller and gathers their speech, handing
 * the transcript to the receptionist agent at /voice/respond. A turn-based AI
 * front desk — 24/7 answering that books/takes messages, gated by approval.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const params: Record<string, string> = {};
  if (form) for (const [k, v] of form.entries()) params[k] = v.toString();

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const url = twilioWebhookUrl(req.url, "/api/webhooks/twilio/voice");
    const sig = req.headers.get("x-twilio-signature") ?? "";
    if (!sig || !twilioSignatureValid(url, params, sig, authToken)) {
      return xml('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>', 403);
    }
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const action = `${base}/api/webhooks/twilio/voice/respond?turn=1`;
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" action="${action}" method="POST" speechTimeout="auto"><Say>Thanks for calling! How can I help you today?</Say></Gather><Say>Sorry, I didn't catch that. Please call back anytime. Goodbye!</Say></Response>`;
  return xml(body);
}
