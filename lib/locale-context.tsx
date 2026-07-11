"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { type Locale, dictionaries } from "@/lib/i18n";

const STORAGE_KEY = "ff_locale";

type LocaleCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const Ctx = createContext<LocaleCtx>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

/**
 * The initial locale is decided by middleware from the URL (e.g. /pt) and
 * passed in from the server layout, so the SSR HTML is already localized.
 * setLocale updates the rendered language + persists the choice; the language
 * switcher also navigates to the matching localized URL.
 */
export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = initialLocale;
  }, [initialLocale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.cookie = `${STORAGE_KEY}=${l};path=/;max-age=31536000;samesite=lax`;
      document.documentElement.lang = l;
    } catch {
      /* storage blocked */
    }
  }, []);

  const t = useCallback(
    (key: string) => dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key,
    [locale]
  );

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useLocale() {
  return useContext(Ctx);
}
