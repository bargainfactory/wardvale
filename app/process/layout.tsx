import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";

// The process page is a client component (can't export metadata), so its per-page
// title/description/canonical live here in a server segment layout. Locale-aware
// canonical so /es/process self-canonicalizes rather than pointing at the English URL.
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    title: t("process.metaTitle"),
    description: t("process.metaDesc"),
    alternates: { canonical: locale === "en" ? "/process" : `/${locale}/process` },
  };
}

export default function ProcessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
