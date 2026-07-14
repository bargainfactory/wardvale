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

-- OAuth tokens for connectors. Server-only (service role) — the RLS read policy
-- and every app query select only provider/status/scope, never these columns.
alter table public.connections add column if not exists access_token text;
alter table public.connections add column if not exists refresh_token text;
alter table public.connections add column if not exists expires_at timestamptz;
alter table public.connections add column if not exists external_id text;
create unique index if not exists connections_client_provider_uidx on public.connections (client_id, provider);

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

-- ── Agent decision tracing ───────────────────────────────────────────────────
-- One row per agent invocation: spans (guardrail/model/parse), timings, tokens,
-- redacted input/output, and flags. Used to debug decisions and build golden
-- eval sets from real traffic. Server-only (service role); no public policies.
create table if not exists public.traces (
  id          uuid primary key default gen_random_uuid(),
  route       text not null,
  session_id  text,
  status      text not null default 'ok',
  latency_ms  integer,
  tokens      integer,
  input       text,
  output      text,
  spans       jsonb not null default '[]'::jsonb,
  flags       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists traces_route_created_idx on public.traces (route, created_at desc);
create index if not exists traces_status_idx on public.traces (status);

alter table public.traces enable row level security;

-- ── Turnkey: self-serve provisioning, business profile, agent config ─────────
-- Clients gain a plan + lifecycle status so sign-up / Stripe can provision and
-- suspend them without manual seeding, plus a timezone + onboarding flag.
alter table public.clients add column if not exists plan text not null default 'trial';
alter table public.clients add column if not exists status text not null default 'active';
alter table public.clients add column if not exists stripe_customer_id text;
alter table public.clients add column if not exists timezone text not null default 'America/New_York';
alter table public.clients add column if not exists onboarded boolean not null default false;
create index if not exists clients_stripe_customer_idx on public.clients (stripe_customer_id);

-- The business's own context, injected into every agent's prompt so drafts are
-- accurate without custom engineering. One row per client.
create table if not exists public.business_profile (
  client_id   uuid primary key references public.clients (id) on delete cascade,
  industry    text,
  hours       text,
  services    text,
  pricing     text,
  faq         text,
  tone        text not null default 'friendly and professional',
  updated_at  timestamptz not null default now()
);

drop trigger if exists business_profile_touch on public.business_profile;
create trigger business_profile_touch
  before update on public.business_profile
  for each row execute function public.touch_updated_at();

-- Per-client agent enablement + behavior. The runtime and scheduler read this to
-- decide which agents run, how often, and whether their actions auto-send or
-- wait for approval. Written by provisioning/packs (service role) and the owner.
create table if not exists public.agent_config (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  agent_key   text not null,
  enabled     boolean not null default false,
  auto_send   boolean not null default false,     -- false = queue for approval (safe default)
  schedule    text not null default 'manual' check (schedule in ('manual', 'hourly', 'daily', 'off')),
  last_run_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (client_id, agent_key)
);
create index if not exists agent_config_client_idx on public.agent_config (client_id);
create index if not exists agent_config_schedule_idx on public.agent_config (schedule) where enabled;

alter table public.business_profile enable row level security;
alter table public.agent_config enable row level security;

drop policy if exists business_profile_self_read on public.business_profile;
create policy business_profile_self_read on public.business_profile
  for select using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );
drop policy if exists business_profile_self_update on public.business_profile;
create policy business_profile_self_update on public.business_profile
  for update using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  ) with check (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );

drop policy if exists agent_config_self_read on public.agent_config;
create policy agent_config_self_read on public.agent_config
  for select using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );
drop policy if exists agent_config_self_update on public.agent_config;
create policy agent_config_self_update on public.agent_config
  for update using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  ) with check (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );

-- ── Outcomes: closed-loop ROI attribution ────────────────────────────────────
-- One row per executed agent action, with the dollars at stake. Starts 'pending'
-- (pipeline) and is resolved to 'won' (realized $) or 'lost' — automatically
-- where we can observe it, or by the owner. This is the proof-of-value dataset.
create table if not exists public.outcomes (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  approval_id  uuid references public.approvals (id) on delete set null,
  agent        text,
  action       text,
  kind         text,                 -- agent key (ar-followup, cart-recovery, …)
  status       text not null default 'pending' check (status in ('pending', 'won', 'lost')),
  value        numeric not null default 0,
  detail       text,
  ref          text,                 -- external key (invoice #, checkout id) for auto-resolution
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists outcomes_client_created_idx on public.outcomes (client_id, created_at desc);
create index if not exists outcomes_client_status_idx on public.outcomes (client_id, status);

-- ── Action idempotency (Phase 1, roadmap G2) ─────────────────────────────────
-- A deterministic dedupe_key (see lib/dedupe.ts: client | agent-kind | action |
-- ref | UTC-day) collapses the SAME proposed action from two overlapping runs
-- (e.g. a cron tick racing a manual portal run) into one row — so the owner is
-- never shown, and auto-send never fires, the same action twice. The random
-- default gives every pre-existing/keyless row a distinct value, so the unique
-- index builds cleanly and only intentional keys ever dedupe.
alter table public.approvals
  add column if not exists dedupe_key text not null default encode(gen_random_bytes(12), 'hex');
create unique index if not exists approvals_dedupe_key_uidx on public.approvals (dedupe_key);

alter table public.outcomes
  add column if not exists dedupe_key text not null default encode(gen_random_bytes(12), 'hex');
create unique index if not exists outcomes_dedupe_key_uidx on public.outcomes (dedupe_key);

-- ── Error/degradation events (Phase 1, roadmap G6) ───────────────────────────
-- Central sink for failures the resilient `catch {}` blocks used to swallow
-- silently (see lib/report.ts). Lets ops tell "0 rows because idle" from "0 rows
-- because the connector errored". Server-only (service role); no public policies.
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

-- ── White-label: agencies manage many clients under their own brand ──────────
create table if not exists public.agencies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  owner_email  text unique not null,
  brand_color  text not null default '#22d3ee',
  created_at   timestamptz not null default now()
);
alter table public.clients add column if not exists agency_id uuid references public.agencies (id) on delete set null;
create index if not exists clients_agency_idx on public.clients (agency_id);

alter table public.agencies enable row level security;
drop policy if exists agencies_self_read on public.agencies;
create policy agencies_self_read on public.agencies
  for select using (owner_email = (auth.jwt() ->> 'email'));

-- ── Governance: per-client execution policies ────────────────────────────────
-- Guardrails the owner sets: an auto-send spend cap, a per-action approval
-- threshold, and a recipient-domain allowlist. Enforced before any auto-send;
-- when a policy would be crossed, the action is queued for approval instead.
create table if not exists public.client_policy (
  client_id             uuid primary key references public.clients (id) on delete cascade,
  daily_spend_cap       numeric,   -- null = no cap; max auto-sent value per day
  require_approval_over numeric,   -- null = no threshold; queue actions above this value
  allowed_domains       text,      -- comma-separated; empty = all allowed (email only)
  updated_at            timestamptz not null default now()
);

drop trigger if exists client_policy_touch on public.client_policy;
create trigger client_policy_touch
  before update on public.client_policy
  for each row execute function public.touch_updated_at();

alter table public.client_policy enable row level security;
drop policy if exists client_policy_self_read on public.client_policy;
create policy client_policy_self_read on public.client_policy
  for select using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );
drop policy if exists client_policy_self_update on public.client_policy;
create policy client_policy_self_update on public.client_policy
  for update using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  ) with check (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );

-- ── Learning loop: approved/edited drafts become per-client few-shot exemplars ─
create table if not exists public.agent_feedback (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  agent_key   text not null,
  kind        text not null check (kind in ('approved', 'edited', 'rejected')),
  sample      text,
  created_at  timestamptz not null default now()
);
create index if not exists agent_feedback_lookup_idx on public.agent_feedback (client_id, agent_key, created_at desc);
alter table public.agent_feedback enable row level security;
drop policy if exists agent_feedback_self_read on public.agent_feedback;
create policy agent_feedback_self_read on public.agent_feedback
  for select using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );

alter table public.outcomes enable row level security;
drop policy if exists outcomes_self_read on public.outcomes;
create policy outcomes_self_read on public.outcomes
  for select using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );
drop policy if exists outcomes_self_update on public.outcomes;
create policy outcomes_self_update on public.outcomes
  for update using (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  ) with check (
    client_id in (select id from public.clients where email = (auth.jwt() ->> 'email'))
  );
