"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { type Locale, locales, dictionaries } from "@/lib/i18n";

const STORAGE_KEY = "ff_locale";

function isLocale(v: string): v is Locale {
  return (locales as string[]).includes(v);
}

// Prefer an explicit saved choice, else the browser's language, else English.
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
    const nav = (navigator.languages?.[0] || navigator.language || "en").slice(0, 2).toLowerCase();
    if (isLocale(nav)) return nav;
  } catch {
    /* storage blocked */
  }
  return "en";
}

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

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Auto-detect on first client render (server always renders English).
  useEffect(() => {
    const detected = detectLocale();
    if (detected !== "en") setLocaleState(detected);
    document.documentElement.lang = detected;
  }, []);

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
