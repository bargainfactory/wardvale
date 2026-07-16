import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";

// The services page is a client component (can't export metadata), so its per-page
// title/description/canonical live here in a server segment layout. Locale-aware
// canonical so /es/services self-canonicalizes rather than pointing at the English URL.
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    title: t("services.metaTitle"),
    description: t("services.metaDesc"),
    alternates: { canonical: locale === "en" ? "/services" : `/${locale}/services` },
  };
}

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
