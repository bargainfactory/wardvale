-- FlowForge AI — Supabase schema
-- Run in the Supabase SQL editor (or via `supabase db push`) to enable
-- lead capture (/api/quote, /api/audit) and subscriber provisioning
-- (/api/stripe/webhook). Both features degrade gracefully if these tables
-- or the SUPABASE_SERVICE_ROLE_KEY are absent.

create extension if not exists "pgcrypto";

-- Leads captured from the instant-quote and 60s-audit forms.
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  email         text,
  business_type text,
  pain_points   text,
  source        text not null check (source in ('quote', 'audit', 'workflow')),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- Subscribers provisioned by successful Stripe checkout.
create table if not exists public.subscribers (
  id                 uuid primary key default gen_random_uuid(),
  stripe_customer_id text unique,
  email              text,
  tier               text,
  status             text not null default 'active',
  last_session_id    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists subscribers_email_idx on public.subscribers (email);

-- Keep updated_at fresh on subscriber changes.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscribers_touch on public.subscribers;
create trigger subscribers_touch
  before update on public.subscribers
  for each row execute function public.touch_updated_at();

-- ── Client portal: live automation run logs + ROI ────────────────────────────

-- A client organization, linked to an auth user by email and to a subscriber.
-- `ingest_key` authenticates run events posted from the client's Zapier/Make.
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text unique,
  tier        text,
  ingest_key  text unique not null default encode(gen_random_bytes(24), 'hex'),
  created_at  timestamptz not null default now()
);

create index if not exists clients_email_idx on public.clients (email);

-- Automations we run for a client.
create table if not exists public.automations (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  name        text not null,
  status      text not null default 'active' check (status in ('active', 'paused')),
  created_at  timestamptz not null default now()
);

create index if not exists automations_client_idx on public.automations (client_id);

-- Append-only log of every automation run. This is the ROI + benchmark dataset.
create table if not exists public.runs (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  automation_id  uuid references public.automations (id) on delete set null,
  status         text not null default 'success' check (status in ('success', 'failed')),
  minutes_saved  numeric not null default 0,
  dollars_saved  numeric not null default 0,
  detail         text,
  created_at     timestamptz not null default now()
);

create index if not exists runs_client_created_idx on public.runs (client_id, created_at desc);

-- Per-client, current-month rollup for fast portal KPIs.
-- security_invoker makes the caller's RLS apply to the underlying `runs`, so a
-- signed-in client sees only their own row (and the anon key sees nothing).
create or replace view public.client_month_rollup with (security_invoker = true) as
select
  client_id,
  count(*)                                             as runs_this_month,
  coalesce(sum(minutes_saved), 0) / 60.0               as hours_saved,
  coalesce(sum(dollars_saved), 0)                      as dollars_saved,
  round(100.0 * avg((status = 'success')::int), 1)     as success_rate
from public.runs
where created_at >= date_trunc('month', now())
group by client_id;

-- Belt-and-suspenders: never expose the rollup view to the public API roles.
revoke all on public.client_month_rollup from anon, authenticated;

-- RLS: leads/subscribers are server-only (no policies). Portal tables let a
-- signed-in user read ONLY rows for the client whose email matches their JWT.
alter table public.leads enable row level security;
alter table public.subscribers enable row level security;
alter table public.clients enable row level security;
alter table public.automations enable row level security;
alter table public.runs enable row level security;

drop policy if exists clients_self_read on public.clients;
create policy clients_self_read on public.clients
  for select using (email = (auth.jwt() ->> 'email'));

drop policy if exists automations_self_read on public.automations;
create policy automations_self_read on public.automations
  for select using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );

drop policy if exists runs_self_read on public.runs;
create policy runs_self_read on public.runs
  for select using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );

-- ── Agent control plane: connections + governance audit ──────────────────────
alter table public.automations add column if not exists kind text not null default 'agent';

-- Least-privilege connections to the tools agents act on.
create table if not exists public.connections (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  provider    text not null,
  status      text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  scope       text,
  created_at  timestamptz not null default now()
);
create index if not exists connections_client_idx on public.connections (client_id);

-- Immutable governance audit: pauses/resumes, approvals, config changes.
create table if not exists public.agent_audit (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  automation_id  uuid references public.automations (id) on delete set null,
  actor          text,
  action         text not null,
  detail         text,
  created_at     timestamptz not null default now()
);
create index if not exists agent_audit_client_created_idx on public.agent_audit (client_id, created_at desc);

alter table public.connections enable row level security;
alter table public.agent_audit enable row level security;

drop policy if exists connections_self_read on public.connections;
create policy connections_self_read on public.connections
  for select using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );

drop policy if exists agent_audit_self_read on public.agent_audit;
create policy agent_audit_self_read on public.agent_audit
  for select using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );

-- Owners can pause/resume (kill switch) only their own agents from the portal.
drop policy if exists automations_self_update on public.automations;
create policy automations_self_update on public.automations
  for update using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  ) with check (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );

-- Human-in-the-loop: agents queue gated actions (send, charge, publish) here
-- for owner sign-off. The runtime writes 'pending'; the owner approves/rejects.
create table if not exists public.approvals (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  automation_id  uuid references public.automations (id) on delete set null,
  agent          text,
  action         text not null,
  summary        text,
  payload        jsonb not null default '{}'::jsonb,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by     text,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz
);
create index if not exists approvals_client_status_idx on public.approvals (client_id, status, created_at desc);

alter table public.approvals enable row level security;
drop policy if exists approvals_self_read on public.approvals;
create policy approvals_self_read on public.approvals
  for select using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );
drop policy if exists approvals_self_update on public.approvals;
create policy approvals_self_update on public.approvals
  for update using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  ) with check (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );

-- ── First-party product analytics + A/B experiments ──────────────────────────
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  props       jsonb not null default '{}'::jsonb,
  session_id  text,
  variant     text,
  path        text,
  created_at  timestamptz not null default now()
);

create index if not exists events_name_created_idx on public.events (name, created_at desc);

-- Server-only writes (service role); no public policies.
alter table public.events enable row level security;
