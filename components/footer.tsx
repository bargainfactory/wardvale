"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

export function Footer() {
  const { t } = useLocale();
  return (
    <footer className="relative mt-32 border-t border-border/60 bg-background">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-display font-semibold"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-electric to-indigo-400 text-navy-900">
                <Zap className="h-4 w-4" strokeWidth={2.5} />
              </span>
              FlowForge <span className="gradient-text">AI</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              {t("footer.desc")}
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("footer.agency")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/services" className="hover:text-cyan-electric">{t("nav.services")}</Link></li>
              <li><Link href="/solutions" className="hover:text-cyan-electric">{t("nav.solutions")}</Link></li>
              <li><Link href="/results" className="hover:text-cyan-electric">{t("nav.results")}</Link></li>
              <li><Link href="/impact" className="hover:text-cyan-electric">{t("footer.liveImpact")}</Link></li>
              <li><Link href="/pricing" className="hover:text-cyan-electric">{t("nav.pricing")}</Link></li>
              <li><Link href="/portal" className="hover:text-cyan-electric">{t("nav.portal")}</Link></li>
              <li><Link href="/portal/agency" className="hover:text-cyan-electric">{t("footer.forAgencies")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("footer.resources")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/connect" className="hover:text-cyan-electric">{t("footer.seeData")}</Link></li>
              <li><Link href="/connections" className="hover:text-cyan-electric">{t("footer.connections")}</Link></li>
              <li><Link href="/build" className="hover:text-cyan-electric">{t("footer.buildAutomation")}</Link></li>
              <li><Link href="/mcp" className="hover:text-cyan-electric">{t("footer.mcp")}</Link></li>
              <li><Link href="/pricing#calculator" className="hover:text-cyan-electric">{t("footer.roiCalc")}</Link></li>
              <li><Link href="/pricing#faq" className="hover:text-cyan-electric">{t("footer.faq")}</Link></li>
              <li><Link href="/privacy" className="hover:text-cyan-electric">{t("footer.privacy")}</Link></li>
              <li><Link href="/terms" className="hover:text-cyan-electric">{t("footer.terms")}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} FlowForge AI. {t("footer.rights")}</p>
          <p>{t("footer.builtWith")}</p>
        </div>
      </div>
    </footer>
  );
}
