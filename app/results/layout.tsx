import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";

// The results page is a client component (can't export metadata), so its per-page
// title/description/canonical live here in a server segment layout. Locale-aware
// canonical so /es/results self-canonicalizes rather than pointing at the English URL.
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    title: t("results.metaTitle"),
    description: t("results.metaDesc"),
    alternates: { canonical: locale === "en" ? "/results" : `/${locale}/results` },
  };
}

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
