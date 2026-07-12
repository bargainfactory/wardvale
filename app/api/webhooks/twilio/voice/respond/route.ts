import { NextResponse } from "next/server";
import { twilioSignatureValid, twilioWebhookUrl } from "@/lib/twilio";
import { clientForInboundNumber } from "@/lib/integrations";
import { loadContext } from "@/lib/context";
import { runVoiceTurn } from "@/lib/runtime";
import { getServiceClient } from "@/lib/supabase-server";
import { startTrace } from "@/lib/trace";

const xml = (body: string, status = 200) =>
  new NextResponse(body, { status, headers: { "content-type": "text/xml" } });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const MAX_TURNS = 2;

/**
 * A single receptionist turn: transcribe → answer via the agent (in the
 * business's voice/context) → either continue the conversation or wrap up and
 * queue an approval-gated call-back for the owner. Never sends anything itself.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const turn = Number(url.searchParams.get("turn") ?? "1");

  const form = await req.formData().catch(() => null);
  const params: Record<string, string> = {};
  if (form) for (const [k, v] of form.entries()) params[k] = v.toString();

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const sigUrl = twilioWebhookUrl(req.url, url.pathname + url.search); // signature covers the query
    const sig = req.headers.get("x-twilio-signature") ?? "";
    if (!sig || !twilioSignatureValid(sigUrl, params, sig, authToken)) {
      return xml('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>', 403);
    }
  }

  const said = params.SpeechResult ?? "";
  const from = params.From ?? "";
  const to = params.To ?? "";

  const trace = startTrace("agent.voice");
  trace.setInput(said);
  const cid = await clientForInboundNumber(to);
  const context = cid ? await loadContext(cid) : undefined;
  const reply = await runVoiceTurn(said, context, trace);

  const svc = getServiceClient();
  if (svc && cid) {
    await svc.from("events").insert({
      name: "inbound.voice",
      props: { from, to, said, turn },
      path: "/api/webhooks/twilio/voice/respond",
    });
  }
  await trace.end();

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  const finalTurn = turn >= MAX_TURNS || !said;

  if (finalTurn) {
    // Wrap up: queue a call-back draft for the owner to approve (and edit — that
    // feeds the learning loop). Nothing is sent without approval.
    if (svc && cid && from) {
      await svc.from("approvals").insert({
        client_id: cid,
        agent: "Voice receptionist",
        action: "sms.send",
        summary: `Call-back · ${from}${said ? ` · "${said.slice(0, 100)}"` : ""}`,
        payload: {
          draft: `Hi! Thanks for calling${said ? ` about "${said.slice(0, 140)}"` : ""}. Following up from your call — how can we help?`,
          source: "Voice call follow-up",
          to: from,
        },
      });
      await svc.from("agent_audit").insert({
        client_id: cid,
        actor: "runtime",
        action: "agent.run",
        detail: `Inbound call from ${from} → call-back queued for approval`,
      });
    }
    const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${esc(reply)} Thanks — we'll follow up shortly. Goodbye!</Say><Hangup/></Response>`;
    return xml(body);
  }

  const action = `${base}/api/webhooks/twilio/voice/respond?turn=${turn + 1}`;
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" action="${action}" method="POST" speechTimeout="auto"><Say>${esc(reply)}</Say></Gather><Say>${esc(reply)} We'll follow up shortly. Goodbye!</Say></Response>`;
  return xml(body);
}
