import { headers } from "next/headers";
import { dictionaries, locales, type Locale } from "./i18n";

/**
 * Server-side counterpart to the client `useLocale()` hook. Middleware sets the
 * active locale on the `x-locale` header (from the URL prefix, e.g. /es), so
 * server components can localize by reading it here. Calling this makes a page
 * dynamic, which is correct: one route serves every locale via rewrite.
 */
export async function getLocale(): Promise<Locale> {
  const h = await headers();
  const l = h.get("x-locale");
  return (l && (locales as readonly string[]).includes(l) ? l : "en") as Locale;
}

/** Bind the dictionary lookup to a locale (falls back to English, then the key). */
export function translator(locale: Locale): (key: string) => string {
  return (key: string) => dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key;
}

/** Resolve the request locale and return a `t()` bound to it, for server components. */
export async function getT(): Promise<{ locale: Locale; t: (key: string) => string }> {
  const locale = await getLocale();
  return { locale, t: translator(locale) };
}
