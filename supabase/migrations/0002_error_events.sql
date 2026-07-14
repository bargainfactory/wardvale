-- Migration 0002 — Error / degradation events (Phase 1, roadmap G6)
--
-- Central sink for failures the resilient `catch {}` blocks used to swallow
-- silently (see lib/report.ts). Lets ops tell "0 rows because idle" from "0 rows
-- because the connector errored". Server-only (service role); no public policies.
--
-- Idempotent: safe to run more than once. Mirrored in supabase/schema.sql.

create table if not exists public.error_events (
  id           uuid primary key default gen_random_uuid(),
  level        text not null default 'error' check (level in ('warning', 'error')),
  source       text not null,
  message      text not null,
  client_id    text,
  detail       jsonb not null default '{}'::jsonb,
  fingerprint  text,
  created_at   timestamptz not null default now()
);
create index if not exists error_events_created_idx on public.error_events (created_at desc);
create index if not exists error_events_source_idx on public.error_events (source, created_at desc);
alter table public.error_events enable row level security;
