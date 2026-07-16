import type { Metadata } from "next";
import { PageLayout } from "@/components/page-layout";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    title: t("legal.privacyMetaTitle"),
    description: t("legal.privacyMetaDescription"),
    alternates: { canonical: locale === "en" ? "/privacy" : `/${locale}/privacy` },
  };
}

export default async function PrivacyPage() {
  const { t } = await getT();
  return (
    <PageLayout>
      <article className="container prose prose-invert max-w-3xl py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{t("legal.privacyTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("legal.lastUpdated")}</p>

        <p className="mt-6 text-muted-foreground">{t("legal.privacyIntro")}</p>

        <Section title={t("legal.privacyS1Heading")}>
          <ul>
            <li><strong>{t("legal.privacyS1Item1Label")}</strong> {t("legal.privacyS1Item1Body")}</li>
            <li><strong>{t("legal.privacyS1Item2Label")}</strong> {t("legal.privacyS1Item2Body")}</li>
            <li><strong>{t("legal.privacyS1Item3Label")}</strong> {t("legal.privacyS1Item3Body")}</li>
            <li><strong>{t("legal.privacyS1Item4Label")}</strong> {t("legal.privacyS1Item4Body")}</li>
          </ul>
        </Section>

        <Section title={t("legal.privacyS2Heading")}>
          <ul>
            <li>{t("legal.privacyS2Item1")}</li>
            <li>{t("legal.privacyS2Item2")}</li>
            <li>{t("legal.privacyS2Item3")}</li>
          </ul>
          <p>{t("legal.privacyS2Note")}</p>
        </Section>

        <Section title={t("legal.privacyS3Heading")}>
          <p>{t("legal.privacyS3Body")}</p>
        </Section>

        <Section title={t("legal.privacyS4Heading")}>
          <p>{t("legal.privacyS4Body")}</p>
        </Section>

        <Section title={t("legal.privacyS5Heading")}>
          <p>
            {t("legal.privacyS5BodyBefore")}{" "}
            <a href="mailto:privacy@flowforge.ai" className="text-cyan-electric">privacy@flowforge.ai</a>{" "}
            {t("legal.privacyS5BodyAfter")}
          </p>
        </Section>

        <Section title={t("legal.privacyS6Heading")}>
          <p>{t("legal.privacyS6Body")}</p>
        </Section>

        <Section title={t("legal.privacyS7Heading")}>
          <p>
            {t("legal.privacyS7BodyBefore")}{" "}
            <a href="mailto:privacy@flowforge.ai" className="text-cyan-electric">privacy@flowforge.ai</a>.
          </p>
        </Section>
      </article>
    </PageLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
