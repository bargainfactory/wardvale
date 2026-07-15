-- Migration 0006 — Scheduled touches (Phase 3 · U2 slice 4)
--
-- Durable multi-touch cadence for the concierge: future follow-up/check-in steps
-- (dueInDays > 0) land here with a fire_at; the /api/cron/touches job promotes
-- each into the approval queue when it comes due. Server-only (service role).
--
-- Idempotent: safe to run more than once. Mirrored in supabase/schema.sql.

create table if not exists public.scheduled_touches (
  id           uuid primary key default gen_random_uuid(),
  client_id    text,
  run_id       text,
  kind         text,
  agent        text,
  summary      text,
  draft        text,
  recipient    text,
  learn_kind   text,
  dedupe_key   text,
  fire_at      timestamptz not null,
  status       text not null default 'pending' check (status in ('pending', 'fired', 'cancelled')),
  created_at   timestamptz not null default now()
);
create index if not exists scheduled_touches_due_idx on public.scheduled_touches (status, fire_at);
create unique index if not exists scheduled_touches_dedupe_uidx on public.scheduled_touches (dedupe_key);
alter table public.scheduled_touches enable row level security;
