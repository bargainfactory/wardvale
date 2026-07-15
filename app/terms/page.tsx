import type { Metadata } from "next";
import { PageLayout } from "@/components/page-layout";
import { getT } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("legal.termsMetaTitle"),
    description: t("legal.termsMetaDescription"),
    alternates: { canonical: "/terms" },
  };
}

export default async function TermsPage() {
  const { t } = await getT();
  return (
    <PageLayout>
      <article className="container max-w-3xl py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{t("legal.termsTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("legal.lastUpdated")}</p>

        <p className="mt-6 text-muted-foreground">{t("legal.termsIntro")}</p>

        <Section title={t("legal.termsS1Heading")}>
          <p>{t("legal.termsS1Body")}</p>
        </Section>

        <Section title={t("legal.termsS2Heading")}>
          <p>{t("legal.termsS2Body")}</p>
        </Section>

        <Section title={t("legal.termsS3Heading")}>
          <p>{t("legal.termsS3Body")}</p>
        </Section>

        <Section title={t("legal.termsS4Heading")}>
          <p>{t("legal.termsS4Body")}</p>
        </Section>

        <Section title={t("legal.termsS5Heading")}>
          <p>{t("legal.termsS5Body")}</p>
        </Section>

        <Section title={t("legal.termsS6Heading")}>
          <p>
            {t("legal.termsS6BodyBefore")}{" "}
            <a href="mailto:hello@flowforge.ai" className="text-cyan-electric">hello@flowforge.ai</a>.
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
      <div className="mt-2 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}
