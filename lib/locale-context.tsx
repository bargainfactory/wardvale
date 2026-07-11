"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type Locale, dictionaries } from "@/lib/i18n";

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
  const [locale, setLocale] = useState<Locale>("en");

  const t = useCallback(
    (key: string) => dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key,
    [locale]
  );

  return (
    <Ctx.Provider value={{ locale, setLocale, t }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLocale() {
  return useContext(Ctx);
}
