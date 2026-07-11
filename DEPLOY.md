# FlowForge AI — Go‑Live Runbook

This is the end‑to‑end checklist to take the turnkey platform from "builds locally"
to "a customer can sign up, onboard, and have agents running." Work top to bottom.

Everything degrades gracefully: if a piece of config is missing, that feature
no‑ops (cron 503s, emails skip, connectors show "Setup needed") rather than
breaking the site. So you can go live incrementally.

---

## 0. Prerequisites

| Account | Why |
|---|---|
| **Vercel** (Pro plan) | Hosting + Cron. Hourly cron needs Pro — Hobby crons run at most once/day. |
| **Supabase** | Postgres + Auth (portal sign‑in) + service role for provisioning. |
| **Stripe** | Subscriptions → provisioning. |
| **Resend** | Approval + digest emails (optional but recommended). |
| **OpenAI** | Agent drafting (falls back to templates without it). |
| Per‑connector OAuth apps | Only for the tools you want live (QuickBooks, Shopify, etc.). |

---

## 1. Database migration (Supabase)

The whole schema lives in [`supabase/schema.sql`](supabase/schema.sql) and is
**idempotent** — every statement is `create … if not exists` / `add column if
not exists` / `drop policy … create policy`, so it's safe to run repeatedly.

1. Supabase dashboard → **SQL Editor** → paste the full contents of
   `supabase/schema.sql` → **Run**.
2. Confirm the new turnkey objects exist (Table editor):
   - `clients` has `plan`, `status`, `stripe_customer_id`, `timezone`, `onboarded`
   - tables `business_profile` and `agent_config` exist
3. RLS is enabled with self read/update policies — verify **RLS is ON** for
   `clients`, `automations`, `runs`, `connections`, `agent_audit`, `approvals`,
   `business_profile`, `agent_config`.

> Server‑only tables (`leads`, `subscribers`, `events`, `traces`) have RLS on
> with **no** policies by design — only the service role touches them.

---

## 2. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production).
The full annotated list is in [`.env.example`](.env.example).

### Minimum to go live (self‑serve signup + agents)

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` — used in redirects, emails, OAuth callbacks. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase → Project Settings → API. |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. **Server‑only** — never expose. Provisioning + cron need it. |
| `OPENAI_API_KEY` | Agent drafting. Omit → template fallback (still works). |
| `CRON_SECRET` | Any long random string. Authenticates `/api/cron/*`. See §5. |
| `RESEND_API_KEY` / `EMAIL_FROM` | Approval + digest emails. `EMAIL_FROM="FlowForge AI <hello@yourdomain.com>"`. |

### Billing (to make paid plans provision)

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`,
`STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE` (and `STRIPE_PRICE_GROWTH_B` only if
you run the growth A/B test). See §3.

### Connectors (only the ones you want live)

Each connector is "Setup needed" until its `*_CLIENT_ID` + `*_CLIENT_SECRET` are
set. Per‑tenant hosts also need: `SHOPIFY_SHOP`, `ZENDESK_SUBDOMAIN`,
`GORGIAS_SUBDOMAIN`, `WORKDAY_AUTH_URL`/`WORKDAY_TOKEN_URL`. Env‑switchable:
`QUICKBOOKS_ENV`, `DOCUSIGN_AUTH_BASE`, `GUSTO_API_BASE`. API‑key connectors
(Twilio/Stripe/Yelp) need nothing at the platform level — clients paste their own
keys. `TWILIO_AUTH_TOKEN` is only for validating inbound webhook signatures.

### Optional hardening / extras

`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (durable rate limiting),
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (form bot protection),
`ADMIN_TOKEN` (trace export), `POSTHOG_KEY`, `NEXT_PUBLIC_CALENDLY_URL`.

---

## 3. Stripe setup

1. **Products/prices**: create a recurring Price for each tier (Starter, Growth,
   Scale). Copy each price id into `STRIPE_PRICE_STARTER/GROWTH/SCALE`.
2. **Webhook**: Developers → Webhooks → Add endpoint:
   - URL: `https://yourdomain.com/api/stripe/webhook`
   - Events: **`checkout.session.completed`**, **`customer.subscription.deleted`**,
     **`invoice.payment_failed`**
   - Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`.
3. How it wires to provisioning (already coded):
   - Checkout ([`app/api/stripe/checkout/route.ts`](app/api/stripe/checkout/route.ts))
     puts the plan in `metadata.tier`.
   - The webhook ([`app/api/stripe/webhook/route.ts`](app/api/stripe/webhook/route.ts))
     on `checkout.session.completed` calls `provisionClient()` → the client goes
     **active** with the plan mapped from the tier, agents + profile seeded.
   - Cancel / failed payment → the client is set `canceled` / `past_due`, and the
     scheduler stops running their agents.

> Sign‑up without payment also works: a signed‑in Supabase user with no client is
> provisioned on the spot as **trial** the first time they open `/portal`.

---

## 4. Connectors (per tool you enable)

For each **OAuth** connector, create its OAuth app and add the redirect URI:

```
https://yourdomain.com/api/connect/<provider>/callback
```

`<provider>` is the connector id (e.g. `quickbooks`, `shopify`, `microsoft`,
`salesforce`, `hubspot`, `google`, `zendesk`, `gorgias`, `intercom`, `klaviyo`,
`mailchimp`, `gusto`, `jobber`, `clio`, `square`, `docusign`, `meta`, `slack`,
`calendly`). Then set that provider's `*_CLIENT_ID` / `*_CLIENT_SECRET`.

- **QuickBooks**: set `QUICKBOOKS_ENV=production` for live data (default sandbox).
- **Shopify / Zendesk / Gorgias**: also set the shop/subdomain env var.
- **Twilio** (SMS): clients paste SID + auth token + from‑number in the portal.
  For inbound SMS, point your Twilio number's webhook at
  `https://yourdomain.com/api/webhooks/twilio` and set `TWILIO_AUTH_TOKEN` to
  validate signatures.
- **Google Business Profile** reuses `GOOGLE_CLIENT_ID/SECRET`.

Non‑standard‑auth tools (NetSuite, Sage, Bill.com, ServiceTitan, Toast, Plaid,
ADP) are intentionally not wired — the `/connections` page says so.

---

## 5. Deploy to Vercel + Cron

1. Import the GitHub repo into Vercel (Framework preset: **Next.js**).
2. Add all env vars from §2 (Production scope).
3. Deploy. The build must be green (`next build`).
4. **Cron** is declared in [`vercel.json`](vercel.json):
   - `/api/cron/run-agents` — hourly (`0 * * * *`), runs due agents.
   - `/api/cron/digest` — daily 13:00 UTC, emails pending‑approval counts.
5. **Cron auth**: when `CRON_SECRET` is set as a Vercel env var, Vercel Cron
   automatically sends `Authorization: Bearer $CRON_SECRET`, which both routes
   check. No extra config. (Without `CRON_SECRET`, the routes return 503 — the
   scheduler is simply off.)

> **Plan note:** hourly cron requires **Vercel Pro**. On Hobby, change the
> `run-agents` schedule to daily, or trigger it yourself (see §6).

---

## 6. Post‑deploy verification

Run through this once after the first deploy.

- [ ] **Signup → provision**: sign in at `/portal/login`; open `/portal` → you get
      a live (non‑demo) dashboard, `plan: trial`. Check Supabase `clients` for the
      new row + `agent_config` rows.
- [ ] **Onboarding**: the "finish setup" banner shows; `/portal/onboarding` saves a
      pack + profile; the banner disappears (`onboarded=true`).
- [ ] **Context**: run an agent from the Agents tab — the draft reflects your
      business profile (tone/services).
- [ ] **Approvals**: a run queues approvals; approving `email.send`/`sms.send`
      actually sends (needs Resend / a connected Twilio).
- [ ] **Config + entitlements**: toggling more agents than your plan allows is
      rejected with the plan message.
- [ ] **Scheduler** (manual trigger):
      ```bash
      curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/run-agents
      curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/digest
      ```
      Expect `{ "ok": true, ... }`. A wrong/absent secret → 401/503.
- [ ] **Stripe**: use Stripe test mode → complete a checkout → the client flips to
      the paid plan (`clients.plan`, `status=active`).
- [ ] **Connections**: a "Ready" connector completes OAuth and appears connected;
      an expired one shows the **Reconnect** prompt.

---

## 7. Safety & rollback

- **DB**: the migration only adds objects (no drops of data columns); re‑running
  is safe. To roll back app code, redeploy a previous Vercel deployment — the new
  columns/tables are additive and won't break older code.
- **Secrets**: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `CRON_SECRET`,
  and all connector secrets are server‑only. Never add them to
  `NEXT_PUBLIC_*`.
- **Kill switch**: any agent can be paused from the portal; a client set to
  `canceled`/`past_due` is skipped by the scheduler automatically.
- **Auto‑send** defaults **off** — every outbound action waits for approval until
  a client explicitly turns it on per agent.

---

## Quick "smallest live footprint"

Want the fastest path to a working turnkey signup without billing or connectors?
Set just: `NEXT_PUBLIC_SITE_URL`, the three Supabase vars, `OPENAI_API_KEY`,
`RESEND_API_KEY` + `EMAIL_FROM`, and `CRON_SECRET`. Run the migration, deploy.
Users can sign up, onboard, and run agents on pasted/sample data with approvals +
notifications. Add Stripe (§3) and connectors (§4) when ready.
