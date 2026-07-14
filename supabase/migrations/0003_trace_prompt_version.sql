-- Migration 0003 — Prompt versioning on traces (Phase 2, roadmap G8)
--
-- Records which prompt version produced each traced decision, so quality scores
-- (LLM-judge layer) and realized ROI can be attributed to the exact prompt —
-- the join key that turns "prompt v2 lifted ROI 8%" into a provable statement.
--
-- Idempotent: safe to run more than once. Mirrored in supabase/schema.sql.

alter table public.traces add column if not exists prompt_version text;
create index if not exists traces_prompt_version_idx on public.traces (prompt_version);
