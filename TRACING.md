# Agent decision tracing

Every AI agent invocation writes one row to the `traces` table via
[`lib/trace.ts`](lib/trace.ts): the **spans** (guardrail → model → parse →
decision) with timings, **token usage**, **redacted** input/output, and
**flags** (injection, over-budget, attachment, done, parse_fail, refused).

It's best-effort and **no-ops when Supabase is unconfigured**, so it costs
nothing in the demo. Input/output are PII-redacted before storage. The table is
server-only (RLS on, no public policies).

## Why

1. **Debug a single decision** post-hoc — see exactly what the agent received,
   how long each step took, how many tokens it burned, and why it fell back.
2. **Build golden eval sets from real traffic** — export successful
   input/output pairs, hand-label the good ones, and feed them to the eval
   harness (`npm run eval`) as regression cases.

## Reading traces

Set `ADMIN_TOKEN` and call the export endpoint (server-only, token-gated):

```bash
# Recent workflow traces (full detail)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://flowforge.ai/api/admin/traces?route=workflow&limit=200"

# Golden-set seed: {input, output} pairs from successful runs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://flowforge.ai/api/admin/traces?route=workflow&format=eval"
```

Or in Supabase SQL:

```sql
-- Slowest / most expensive workflow decisions this week
select created_at, latency_ms, tokens, status, flags, left(input, 80) as input
from public.traces
where route = 'workflow' and created_at > now() - interval '7 days'
order by tokens desc
limit 50;

-- Where did agents fall back or get flagged?
select flags, count(*) from public.traces
where flags <> '{}'::jsonb
group by flags order by 2 desc;
```

## Turning traces into a golden eval set

1. Pull `?format=eval` for a route to get `{input, output}` cases.
2. Review and keep the correct ones; note the expected properties (structure,
   no PII leak, no injection obedience) for each.
3. Add them to `evals/run.mjs` (or a JSON fixture it reads) so future prompt/
   model changes are checked against real, labeled behavior — not just synthetic
   cases. `npm run eval` gates CI (exits non-zero on regression).

## Instrumented routes

`/api/workflow` (full: model spans, tokens, done/parse_fail flags, attachment)
and `/api/chat` (injection-refused, over-budget, model spans). Extend to
`/api/quote` and `/api/audit` with the same `startTrace(...)` pattern.
