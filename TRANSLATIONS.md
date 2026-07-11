# Translations & localization

## Languages

| Code | Language | Status | URL prefix |
|------|----------|--------|-----------|
| `en` | English | Source (human) | none — `/services` |
| `es` | Spanish | Original author | `/es/services` |
| `fr` | French | Original author | `/fr/services` |
| `pt` | Portuguese (Brazil) | **AI-generated — needs native proofread** | `/pt/services` |
| `de` | German | **AI-generated — needs native proofread** | `/de/services` |

All strings live in [`lib/i18n.ts`](lib/i18n.ts). Missing keys fall back to English at runtime, so partial translations never break a page.

## ⚠️ Native-proofread checklist (before paid ads in a language)

The `pt` and `de` dictionaries were AI-generated. Have a native speaker review before spending on that market. Priority order (most-seen first):

1. **Nav + hero + primary CTAs** (`nav.*`, `hero.*`, `cta.*`) — first impression.
2. **Pricing** (`pricing.*`, `tier.*`, `compare.*`, `calc.*`) — money page; mistranslations kill trust.
3. **Quote form** (`quote.*`, `biz.*`) — the conversion path.
4. **Services + results + process** (`service.*`, `results.*`, `case.*`, `step.*`).
5. **FAQ + footer + portal** (`faq.*`, `footer.*`, `portal.*`).

Watch specifically for:
- **Currency/number format** — values are hard-coded as `US$`/`$`; localize if you localize pricing.
- **Formality (`de`)** — copy uses the formal *Sie*. Confirm that matches your brand voice; switch to *du* if you want a startup-casual tone.
- **`pt` regionalism** — copy targets **pt-BR** (Brazil). Adjust for pt-PT (Portugal) if needed.
- **Idioms** — e.g. "duct-tape", "warroom", "no-show" were adapted, not literal; verify they land naturally.

## How localized URLs work (SEO)

- English is the default and lives at unprefixed URLs (`/services`). Other languages live under a prefix (`/pt/services`).
- [`middleware.ts`](middleware.ts) maps a prefixed URL to the underlying page and passes the locale via the `x-locale` header, so the **server-rendered HTML at `/pt/services` is actually Portuguese** — i.e. crawlable and indexable, not just a client-side swap.
- First-time visitors are routed to their browser language (via `Accept-Language`); the choice persists in the `ff_locale` cookie and can be changed with the header switcher.
- The root layout emits `<link rel="alternate" hreflang="…">` tags for every locale plus `x-default`, and [`app/sitemap.ts`](app/sitemap.ts) lists language alternates for the fully-translated pages.

## Adding a language

1. Add the code to `Locale`, `locales`, and `localeLabels` in `lib/i18n.ts`.
2. Add a `const xx: Dict = { … }` block and include it in the `dictionaries` export.
3. Add the code to the `PREFIXED` array in `middleware.ts` and the `["es","fr","pt","de"]` lists in `components/nav.tsx` and `app/sitemap.ts`.
4. Mark newly-translated pages in the `localized` set in `app/sitemap.ts`.
