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
   `supabase/schema.sql` → **Run**. (Re‑run it after any `git pull` — new features
   add tables/columns and it's safe to re‑apply.)
2. Confirm the objects exist (Table editor):
   - `clients` has `plan`, `status`, `stripe_customer_id`, `timezone`,
     `onboarded`, `agency_id`
   - **Turnkey**: `business_profile`, `agent_config`
   - **Competitive‑advantage features**: `outcomes` (ROI attribution),
     `agent_feedback` (learning loop), `client_policy` (governance), `agencies`
     (white‑label)
3. RLS is enabled with self read/update policies — verify **RLS is ON** for
   `clients`, `automations`, `runs`, `connections`, `agent_audit`, `approvals`,
   `business_profile`, `agent_config`, `outcomes`, `agent_feedback`,
   `client_policy`, `agencies`.

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
keys. `TWILIO_AUTH_TOKEN` validates inbound SMS/Voice webhook signatures;
`SHOPIFY_WEBHOOK_SECRET` (optional, falls back to `SHOPIFY_CLIENT_SECRET`) and
`TWILIO_WEBHOOK_URL_BASE` (optional, behind a proxy) support the event‑driven +
voice features in §4.

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
- **Twilio** (SMS + Voice): clients paste SID + auth token + from‑number in the
  portal. Set `TWILIO_AUTH_TOKEN` to validate inbound webhook signatures, then in
  the Twilio number config:
  - **Messaging** webhook → `https://yourdomain.com/api/webhooks/twilio`
  - **Voice** webhook → `https://yourdomain.com/api/webhooks/twilio/voice`
    (the AI receptionist; behind a proxy, set `TWILIO_WEBHOOK_URL_BASE`).
- **Google Business Profile** reuses `GOOGLE_CLIENT_ID/SECRET`.

Non‑standard‑auth tools (NetSuite, Sage, Bill.com, ServiceTitan, Toast, Plaid,
ADP) are intentionally not wired — the `/connections` page says so.

### Event‑driven triggers (real‑time, optional)

For instant reactions instead of hourly polling, register Shopify webhooks
(Settings → Notifications → Webhooks, or via the Admin API) pointed at
`https://yourdomain.com/api/webhooks/shopify`:

- `checkouts/create` → fires the **cart‑recovery** agent immediately
- `orders/create` → fires the **review‑request** agent immediately

Requests are HMAC‑verified against `SHOPIFY_WEBHOOK_SECRET` (falls back to
`SHOPIFY_CLIENT_SECRET`) and deduped, so Shopify retries are safe. The shop is
matched to its client by the stored shop domain.

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

### Competitive‑advantage features

- [ ] **ROI attribution**: after approving/sending an action with money at stake
      (AR reminder, cart recovery, lead), the portal **ROI** tab shows it in
      pipeline; marking it **Won** moves it to realized $. Check the `outcomes`
      table.
- [ ] **Learning loop**: edit a draft in **Approvals** before approving → a row
      lands in `agent_feedback`; the next run of that agent reflects the style.
- [ ] **Governance**: in the **Trust** tab, set a daily cap / approval threshold /
      domain allowlist and Save (writes `client_policy`). With auto‑send on, an
      action that crosses a policy is queued instead of sent. Audit CSV downloads
      from **Trust → Export audit log**.
- [ ] **Batch approvals**: select multiple pending items (or "Approve all") and
      confirm they clear.
- [ ] **Voice receptionist**: call the Twilio number → it greets, answers, and
      queues a call‑back in **Approvals**; the call appears in `events`.
- [ ] **Event triggers**: trigger a Shopify test webhook (or abandon a checkout) →
      a cart‑recovery/review approval appears within seconds, no cron wait.
- [ ] **Agency mode**: at `/portal/agency`, create an agency and add a client →
      it appears in the client table (and in `clients.agency_id`).
- [ ] **Benchmarks**: once >3 clients in the same `business_profile.industry` have
      outcomes, the ROI tab shows the anonymized **"How you compare"** panel.

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

## 8. Security checklist

Before handling real customer credentials, confirm:

- [ ] **`TOKEN_ENC_KEY` is set** (`openssl rand -base64 32`). This envelope-encrypts
      stored OAuth tokens + API keys (AES-256-GCM) so a DB dump alone can't read
      them. Keep it stable and backed up — rotating it makes existing encrypted
      tokens unreadable (clients would reconnect). Without it, tokens are stored
      plaintext (dev only).
- [ ] **Email confirmation is required** in Supabase → Auth → Providers (RLS
      trusts the JWT email, so unverified sign-in must be off).
- [ ] **Upstash is configured** (`UPSTASH_REDIS_REST_URL/TOKEN`) — the in-memory
      rate limiter is per-instance and weaker across serverless functions.
- [ ] **Ingest keys** can be rotated by each client in the portal **Trust** tab;
      treat them as secrets.
- [ ] **Security headers** ship from `next.config.ts` (CSP, HSTS, X-Frame-Options
      DENY, nosniff, Referrer-Policy, Permissions-Policy). The CSP allows the
      Supabase origin for client‑side auth/realtime — if you use another
      browser‑facing host (analytics, widgets), add it to `connect-src`.
- [ ] All webhooks verify signatures; cron + admin routes require their secrets;
      sensitive portal mutations are rate‑limited and session‑gated.

**Not yet in place** (don't claim these): third‑party penetration test, SOC 2 /
ISO certification, HIPAA/BAA (so no PHI). The portal Trust tab lists only the
controls that actually exist — keep it that way.

---

## Quick "smallest live footprint"

Want the fastest path to a working turnkey signup without billing or connectors?
Set just: `NEXT_PUBLIC_SITE_URL`, the three Supabase vars, `OPENAI_API_KEY`,
`RESEND_API_KEY` + `EMAIL_FROM`, and `CRON_SECRET`. Run the migration, deploy.
Users can sign up, onboard, and run agents on pasted/sample data with approvals +
notifications. Add Stripe (§3) and connectors (§4) when ready.
