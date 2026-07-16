import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import { faq } from "@/lib/data";

// The pricing page is a client component (can't export metadata), so its per-page
// title/description/canonical live here. Locale-aware canonical so /es/pricing
// self-canonicalizes rather than pointing at the English URL.
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    title: t("pricing.metaTitle"),
    description: t("pricing.metaDesc"),
    alternates: { canonical: locale === "en" ? "/pricing" : `/${locale}/pricing` },
  };
}

export default async function PricingLayout({ children }: { children: React.ReactNode }) {
  // FAQPage structured data is emitted HERE only — /pricing is the one page where
  // the FAQ is actually visible (Google requires the marked-up Q&A on the page).
  // Built from the same localized keys the visible FAQ renders, so es/fr/pt/de get
  // a matching localized rich result instead of the old English-everywhere node.
  const { t } = await getT();
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((_, i) => ({
      "@type": "Question",
      name: t(`faq.${i + 1}.q`),
      acceptedAnswer: { "@type": "Answer", text: t(`faq.${i + 1}.a`) },
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {children}
    </>
  );
}
