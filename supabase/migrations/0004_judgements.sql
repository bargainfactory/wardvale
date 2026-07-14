-- Migration 0004 — Judgements: the LLM-as-judge dataset (Phase 2, roadmap U1)
--
-- One row per judged agent decision. Two tiers write here: cheap deterministic
-- component checks (run on all decisions) and a sampled LLM rubric (grounding /
-- appropriateness / tone / safety). Keyed to prompt_version so agent quality can
-- be measured and attributed to the exact prompt that produced it — the join
-- that makes "prompt v2 scored higher" provable.
--
-- Idempotent: safe to run more than once. Mirrored in supabase/schema.sql.

create table if not exists public.judgements (
  id                uuid primary key default gen_random_uuid(),
  approval_id       uuid references public.approvals (id) on delete cascade,
  client_id         text,
  agent             text,
  kind              text,               -- agent key (ar-followup, cart-recovery, …)
  prompt_version    text,
  component_passed  integer not null default 0,
  component_failed  integer not null default 0,
  checks            jsonb not null default '[]'::jsonb,
  verdict           text,               -- pass | revise | fail (null when the LLM tier was skipped)
  overall           numeric,
  scores            jsonb,
  reasoning         text,
  model             text,
  created_at        timestamptz not null default now()
);
create index if not exists judgements_created_idx on public.judgements (created_at desc);
create index if not exists judgements_version_idx on public.judgements (prompt_version, created_at desc);
-- One judgement per approval → re-running the judge cron is idempotent.
create unique index if not exists judgements_approval_uidx on public.judgements (approval_id);
alter table public.judgements enable row level security;
