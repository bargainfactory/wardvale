"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { localeLabels, locales, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/locale-context";

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { locale, setLocale, t } = useLocale();

  // Current path with any locale prefix stripped (for active-link matching).
  const normalizedPath = (() => {
    const parts = pathname.split("/");
    if ((["es", "fr", "pt", "de"] as string[]).includes(parts[1] ?? "")) parts.splice(1, 1);
    return parts.join("/") || "/";
  })();

  // Switch language. The locales are served via middleware *rewrites*
  // (/es/services → /services with an x-locale header), and every locale URL
  // rewrites to the same underlying route — so App Router client navigation
  // (router.push) dedupes them and the server never re-renders in the new
  // language. A full-document navigation is reliable: middleware runs, the
  // cookie is set, and the page is server-rendered in the target locale.
  const changeLocale = (l: Locale) => {
    setLocale(l); // persist cookie + localStorage so the reloaded page agrees
    const target = l === "en" ? normalizedPath : `/${l}${normalizedPath === "/" ? "" : normalizedPath}`;
    window.location.assign(target);
  };

  const links = [
    { href: "/build", label: "Build" },
    { href: "/services", label: t("nav.services") },
    { href: "/solutions", label: "Solutions" },
    { href: "/connections", label: "Connectors" },
    { href: "/impact", label: "Impact" },
    { href: "/results", label: t("nav.results") },
    { href: "/process", label: t("nav.process") },
    { href: "/pricing", label: t("nav.pricing") },
    { href: "/portal", label: t("nav.portal") },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all",
        scrolled ? "py-2" : "py-4"
      )}
    >
      <div className="container">
        <nav
          className={cn(
            "flex items-center justify-between rounded-full px-4 py-2.5 transition-all",
            scrolled
              ? "glass-strong shadow-lg shadow-black/5"
              : "bg-transparent"
          )}
        >
          <Link
            href="/"
            className="flex items-center gap-2 font-display font-semibold text-base tracking-tight"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-electric to-indigo-400 text-navy-900 shadow-glow">
              <Zap className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span>FlowForge <span className="gradient-text">AI</span></span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm transition-colors hover:text-foreground",
                  normalizedPath === l.href ? "text-cyan-electric" : "text-muted-foreground"
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <LocaleSelect locale={locale} onChange={changeLocale} />
            </div>
            <ThemeToggle />
            <Link href="/pricing#quote" className="hidden md:inline-flex">
              <Button variant="primary" size="sm">
                {t("nav.cta")}
              </Button>
            </Link>
            <button
              type="button"
              aria-label="Menu"
              onClick={() => setOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-full border border-border md:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>

        {open && (
          <div className="glass-strong mt-2 rounded-3xl p-4 md:hidden">
            <div className="flex flex-col">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm hover:bg-white/5"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-3 flex items-center justify-center">
                <LocaleSelect locale={locale} onChange={changeLocale} />
              </div>
              <Link href="/pricing#quote" onClick={() => setOpen(false)}>
                <Button className="mt-3 w-full">{t("nav.cta")}</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function LocaleSelect({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (l: Locale) => void;
}) {
  return (
    <div className="flex rounded-full border border-border bg-card/50 p-0.5 text-xs backdrop-blur">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            locale === l
              ? "bg-cyan-electric text-navy-900"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {localeLabels[l]}
        </button>
      ))}
    </div>
  );
}
