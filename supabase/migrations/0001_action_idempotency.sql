-- Migration 0001 — Action idempotency (Phase 1, roadmap G2)
--
-- Prevents an overlapping cron tick + manual portal run from double-queuing or
-- double-sending the SAME agent action. A deterministic dedupe_key (see
-- lib/dedupe.ts: client | agent-kind | action | ref | UTC-day) plus a UNIQUE
-- index collapses duplicates via ON CONFLICT DO NOTHING.
--
-- The random default means any pre-existing row, or any future insert that does
-- not set a key, gets a distinct value and never collides — so the unique index
-- builds cleanly on a populated table and only INTENTIONAL keys ever dedupe.
--
-- Idempotent: safe to run more than once. Mirrored in supabase/schema.sql.

alter table public.approvals
  add column if not exists dedupe_key text not null default encode(gen_random_bytes(12), 'hex');
create unique index if not exists approvals_dedupe_key_uidx on public.approvals (dedupe_key);

alter table public.outcomes
  add column if not exists dedupe_key text not null default encode(gen_random_bytes(12), 'hex');
create unique index if not exists outcomes_dedupe_key_uidx on public.outcomes (dedupe_key);
