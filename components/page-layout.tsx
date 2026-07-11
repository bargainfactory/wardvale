import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { StickyCTA } from "@/components/sticky-cta";
import { CookieConsent } from "@/components/cookie-consent";

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="pt-28">{children}</main>
      <Footer />
      <StickyCTA />
      <CookieConsent />
    </>
  );
}
