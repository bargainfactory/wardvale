-- Migration 0005 — Link feedback to its approval (Phase 2, roadmap U5)
--
-- Lets the learning loop join each stored draft to its judgement (U1), so
-- loadExemplars can curate few-shot examples by judge score — teaching the agent
-- only from genuinely good drafts, and from rejected ones as negatives.
--
-- Idempotent: safe to run more than once. Mirrored in supabase/schema.sql.

alter table public.agent_feedback
  add column if not exists approval_id uuid references public.approvals (id) on delete set null;
create index if not exists agent_feedback_approval_idx on public.agent_feedback (approval_id);
