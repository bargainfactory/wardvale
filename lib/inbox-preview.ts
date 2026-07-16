import { callModel, modelConfigured } from "@/lib/model";

export type InboxPreview = {
  total: number;
  autoDraft: number;
  triage: number;
  examples: { subject: string; action: string }[];
  estMinutesSaved: number;
};

const ACTIONS = ["Auto-draft reply", "Triage + label", "Archive", "File + log"] as const;

function heuristic(items: { subject: string }[]): InboxPreview {
  const examples = items.slice(0, 6).map((it) => {
    const s = it.subject.toLowerCase();
    let action: string = "Triage + label";
    if (/receipt|invoice|statement|payment|order confirm/.test(s)) action = "File + log";
    else if (/newsletter|digest|unsubscribe|% off|sale|promo/.test(s)) action = "Archive";
    else if (/re:|question|help|support|inquiry|booking|reservation|quote|availab/.test(s)) action = "Auto-draft reply";
    return { subject: it.subject, action };
  });
  const total = items.length;
  const autoDraft = Math.min(total, examples.filter((e) => e.action === "Auto-draft reply").length + Math.round(total * 0.35));
  return { total, autoDraft, triage: Math.max(0, total - autoDraft), examples, estMinutesSaved: total * 4 };
}

/**
 * Turns a sample of the visitor's real inbox (subjects only) into a preview of
 * what an Inbox Triage agent would do. Uses OpenAI when available, else a
 * keyword heuristic. Subjects are processed transiently and never stored.
 */
export async function buildInboxPreview(items: { subject: string; from: string }[]): Promise<InboxPreview> {
  if (!items.length) return heuristic(items);
  if (!modelConfigured()) return heuristic(items);
  try {
    const completion = await callModel({
      purpose: "preview",
      max_tokens: 500,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `For each email subject, choose the automation action a FlowForge inbox agent would take, from exactly: ${ACTIONS.join(
            ", "
          )}. Return JSON { "examples": [{ "subject": string, "action": string }] } covering the given subjects.`,
        },
        { role: "user", content: items.map((i) => i.subject).join("\n") },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      examples?: { subject: string; action: string }[];
    };
    const examples = (parsed.examples ?? []).slice(0, 6);
    if (!examples.length) return heuristic(items);
    const total = items.length;
    const autoDraft = Math.min(total, examples.filter((e) => /draft/i.test(e.action)).length + Math.round(total * 0.3));
    return { total, autoDraft, triage: Math.max(0, total - autoDraft), examples, estMinutesSaved: total * 4 };
  } catch {
    return heuristic(items);
  }
}
