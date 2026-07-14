import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase-server";

// Learning loop (roadmap U5). Every draft the owner approves, edits, or rejects
// is a signal of what "good" looks like for this business. We store it and feed
// curated examples back into that agent's prompt so drafts converge on the
// owner's voice. Curation matters: we rank by the judge's score (U1) so only
// genuinely good drafts are taught, keep it agent-specific, cap the count to
// avoid context bloat, and include a few REJECTED drafts as negatives so the
// agent also learns what to avoid. This compounding per-client history is the
// moat — it doesn't transfer to a competitor.

export async function recordFeedback(
  supabase: SupabaseClient,
  input: {
    clientId: string;
    agentKey?: string | null;
    kind: "approved" | "edited" | "rejected";
    sample?: string | null;
    approvalId?: string | null;
  }
): Promise<void> {
  if (!input.agentKey || !input.sample) return;
  try {
    await supabase.from("agent_feedback").insert({
      client_id: input.clientId,
      agent_key: input.agentKey,
      kind: input.kind,
      sample: input.sample.slice(0, 2000),
      approval_id: input.approvalId ?? null,
    });
  } catch {
    /* non-critical */
  }
}

export type ExemplarCandidate = { kind: "approved" | "edited"; sample: string; approvalId: string | null; createdAt: string };
export type JudgeInfo = { overall: number | null; verdict: string | null };

// Unjudged drafts sit between a judged "pass" and a judged "fail": good enough to
// keep, but a judge-approved draft outranks them.
const NEUTRAL_SCORE = 3.5;

/**
 * Rank positive exemplars for few-shot use (roadmap U5). Judge-FAILED drafts are
 * dropped (never teach from a bad draft); the rest sort by judge score (unjudged
 * get a neutral score), then prefer owner-EDITED drafts (the strongest "good"
 * signal), then recency. Pure + injectable for testing.
 */
export function rankExemplars(candidates: ExemplarCandidate[], judged: Map<string, JudgeInfo>, limit: number): string[] {
  const kindWeight = (k: string) => (k === "edited" ? 1 : 0);
  return candidates
    .map((c) => {
      const j = c.approvalId ? judged.get(c.approvalId) : undefined;
      return { c, j, score: j?.overall ?? NEUTRAL_SCORE, time: new Date(c.createdAt).getTime() };
    })
    .filter((x) => x.j?.verdict !== "fail")
    .sort((a, b) => b.score - a.score || kindWeight(b.c.kind) - kindWeight(a.c.kind) || b.time - a.time)
    .slice(0, Math.max(0, limit))
    .map((x) => x.c.sample);
}

/** Format curated positives (+ optional negatives) into a few-shot prompt block. */
export function formatExemplars(positive: string[], negative: string[]): string {
  const parts: string[] = [];
  if (positive.length) {
    parts.push(
      `EXAMPLES THE OWNER APPROVED — match this style, structure, and voice closely:\n${positive
        .map((s, i) => `Example ${i + 1}:\n${s}`)
        .join("\n\n")}`
    );
  }
  if (negative.length) {
    parts.push(
      `EXAMPLES THE OWNER REJECTED — do NOT write like these; avoid their tone and approach:\n${negative
        .map((s, i) => `Avoid ${i + 1}:\n${s}`)
        .join("\n\n")}`
    );
  }
  return parts.join("\n\n");
}

type PositiveRow = { kind: "approved" | "edited"; sample: string | null; approval_id: string | null; created_at: string };

/**
 * Judge-curated, agent-specific few-shot block: the best recent approved/edited
 * drafts (ranked by judge score) plus a couple of rejected ones as negatives.
 */
export async function loadExemplars(clientId: string, agentKey: string, limit = 3): Promise<string> {
  const supabase = getServiceClient();
  if (!supabase || !agentKey) return "";

  const [{ data: pos }, { data: neg }] = await Promise.all([
    supabase
      .from("agent_feedback")
      .select("kind, sample, approval_id, created_at")
      .eq("client_id", clientId)
      .eq("agent_key", agentKey)
      .in("kind", ["approved", "edited"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("agent_feedback")
      .select("sample")
      .eq("client_id", clientId)
      .eq("agent_key", agentKey)
      .eq("kind", "rejected")
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  const candidates: ExemplarCandidate[] = ((pos ?? []) as PositiveRow[])
    .filter((r) => r.sample)
    .map((r) => ({ kind: r.kind, sample: r.sample as string, approvalId: r.approval_id, createdAt: r.created_at }));

  // Pull judge scores for these drafts so curation can prefer high-quality ones.
  const approvalIds = candidates.map((c) => c.approvalId).filter((x): x is string => Boolean(x));
  const judged = new Map<string, JudgeInfo>();
  if (approvalIds.length) {
    const { data: js } = await supabase.from("judgements").select("approval_id, overall, verdict").in("approval_id", approvalIds);
    for (const j of (js ?? []) as { approval_id: string; overall: number | null; verdict: string | null }[]) {
      judged.set(j.approval_id, { overall: j.overall != null ? Number(j.overall) : null, verdict: j.verdict });
    }
  }

  const positive = rankExemplars(candidates, judged, limit);
  const negative = ((neg ?? []) as { sample: string | null }[]).map((r) => r.sample).filter((s): s is string => Boolean(s));
  return formatExemplars(positive, negative);
}
