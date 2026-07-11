import type { Metadata } from "next";
import { PageLayout } from "@/components/page-layout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How FlowForge AI collects, uses, and protects your data, and how to exercise your GDPR/CCPA rights.",
};

const UPDATED = "January 2026";

export default function PrivacyPage() {
  return (
    <PageLayout>
      <article className="container prose prose-invert max-w-3xl py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {UPDATED}</p>

        <p className="mt-6 text-muted-foreground">
          FlowForge AI (&ldquo;we&rdquo;, &ldquo;us&rdquo;) builds done-for-you automations for small
          businesses. This policy explains what personal data we collect through this website, why, and
          the choices you have. We aim to collect the minimum necessary to serve you.
        </p>

        <Section title="1. What we collect">
          <ul>
            <li><strong>Contact &amp; audit details</strong> you submit — name, email, business type, and the pain points you describe in the quote/audit form.</li>
            <li><strong>Billing data</strong> when you subscribe — processed by Stripe. We never see or store your full card number.</li>
            <li><strong>Essential cookies</strong> — to remember your theme and language preference. We do not run advertising trackers.</li>
            <li><strong>Basic request metadata</strong> (e.g. IP address) used transiently for security and rate limiting.</li>
          </ul>
        </Section>

        <Section title="2. How we use it">
          <ul>
            <li>To generate your automation recommendations and follow up about an engagement.</li>
            <li>To provision and support your subscription (via Stripe and our client portal).</li>
            <li>To protect the site from abuse (rate limiting, CAPTCHA, fraud prevention).</li>
          </ul>
          <p>We do not sell your personal data.</p>
        </Section>

        <Section title="3. Processors we rely on">
          <p>
            We share data only with vendors that help us operate: Stripe (payments), Supabase (database),
            OpenAI (generating recommendations from the details you provide), Resend (transactional email),
            and Cloudflare (bot protection). Each processes data under its own terms and only as needed.
          </p>
        </Section>

        <Section title="4. Data retention">
          <p>
            We keep lead details for as long as needed to follow up or to meet legal obligations, and
            subscriber records for the life of your account plus any legally required period. You can ask us
            to delete your data at any time.
          </p>
        </Section>

        <Section title="5. Your rights">
          <p>
            Depending on where you live (e.g. under GDPR or CCPA), you may have the right to access, correct,
            export, or delete your personal data, and to object to certain processing. To exercise any of
            these, email{" "}
            <a href="mailto:privacy@flowforge.ai" className="text-cyan-electric">privacy@flowforge.ai</a>{" "}
            and we&rsquo;ll respond within 30 days. A signed Data Processing Agreement (DPA) is available on request.
          </p>
        </Section>

        <Section title="6. Security">
          <p>
            We use HTTPS everywhere, a strict content-security policy, signed webhooks, and least-privilege
            access to our database. No method of transmission is 100% secure, but we work to protect your data
            and to notify you of any material breach as required by law.
          </p>
        </Section>

        <Section title="7. Contact">
          <p>
            Questions about this policy? Email{" "}
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
