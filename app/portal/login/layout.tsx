import type { Metadata } from "next";

// Thin sign-in page — keep it out of the index (matches the noindexed onboarding
// and agency portal pages). The page itself is a client component.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PortalLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
