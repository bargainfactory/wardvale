# Experiments

Lightweight, first-party A/B testing. Variants are assigned client-side and
sticky per browser (`getVariant(name)` in `lib/analytics.ts`, stored in
`localStorage` as `ff_exp_<name>`), and events are logged to the Supabase
`events` table via `/api/track`.

## Active: `growth_price` — $2,000 vs $2,500

Tests whether the Growth tier converts better at $2,000 (A) or $2,500 (B).

- **A** → $2,000 (the base `tier.price` in `lib/data.ts`)
- **B** → $2,500 (`GROWTH_PRICE_B` in `app/pricing/page.tsx`)

The variant drives the Growth price on the homepage teaser **and** the pricing
page (price, ROI badge, and checkout). Events carry `growth_variant` +
`growth_price` in their `props`:

- `pricing_view` — fired on every pricing-page load (exposure)
- `checkout_click` — fired when a visitor starts Growth checkout (conversion)

### To run it for real

1. In Stripe, create a **second Growth price at $2,500** and set its id as
   `STRIPE_PRICE_GROWTH_B`. (Without it, variant B still *displays* $2,500 and
   logs the intent, but checkout falls back to the $2,000 price.)
2. Make sure Supabase is configured so events persist (`schema.sql` applied).

### Reading results (Supabase SQL)

```sql
-- Exposures and Growth checkout-clicks per variant, plus revenue-weighted lift
with exposure as (
  select props->>'growth_variant' as variant, count(*) as views
  from events where name = 'pricing_view'
  group by 1
),
clicks as (
  select props->>'growth_variant' as variant,
         count(*) as checkouts,
         avg((props->>'growth_price')::numeric) as price
  from events where name = 'checkout_click' and props->>'tier' = 'growth'
  group by 1
)
select e.variant, e.views, c.checkouts,
       round(100.0 * c.checkouts / e.views, 2)          as conv_pct,
       round(c.checkouts * c.price / e.views, 2)         as revenue_per_view
from exposure e left join clicks c using (variant)
order by e.variant;
```

**Pick the winner on `revenue_per_view`, not `conv_pct`** — a small conversion
drop at the higher price can still win on revenue. Once decided, set
`tier.price` (or `GROWTH_PRICE_B`) to the winner and remove the branch.

## Adding an experiment

1. Call `getVariant("<name>")` where the variation happens (client component).
2. Vary the UI by variant; fire `track("<event>", { <name>_variant: v, … })`
   for both exposure and conversion so the SQL above generalizes.
