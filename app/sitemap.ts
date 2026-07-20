import type { MetadataRoute } from "next";
import { seoPages } from "@/lib/seo-pages";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wardvale.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/build", priority: 0.9, changeFrequency: "monthly" },
    { path: "/services", priority: 0.9, changeFrequency: "monthly" },
    { path: "/solutions", priority: 0.9, changeFrequency: "monthly" },
    { path: "/impact", priority: 0.7, changeFrequency: "weekly" },
    { path: "/connect", priority: 0.7, changeFrequency: "monthly" },
    { path: "/connections", priority: 0.7, changeFrequency: "monthly" },
    { path: "/mcp", priority: 0.6, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/results", priority: 0.8, changeFrequency: "monthly" },
    { path: "/process", priority: 0.7, changeFrequency: "monthly" },
    { path: "/portal", priority: 0.6, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/automations", priority: 0.7, changeFrequency: "monthly" },
    ...seoPages.map((p) => ({
      path: `/automations/${p.slug}`,
      priority: 0.6,
      changeFrequency: "monthly" as MetadataRoute.Sitemap[number]["changeFrequency"],
    })),
  ];

  // Every marketing route is served in all 5 locales via middleware rewrite, so
  // emit hreflang alternates (+ x-default) for all of them — matching the on-page
  // hreflang from app/layout.tsx. Only the auth portal is English-only.
  const notLocalized = new Set(["/portal"]);
  const altLocales = ["es", "fr", "pt", "de"];

  return routes.map((r) => {
    const url = `${siteUrl}${r.path === "/" ? "" : r.path}`;
    const entry: MetadataRoute.Sitemap[number] = {
      url,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    };
    if (!notLocalized.has(r.path)) {
      const languages: Record<string, string> = { en: url, "x-default": url };
      for (const l of altLocales) {
        languages[l] = `${siteUrl}/${l}${r.path === "/" ? "" : r.path}`;
      }
      entry.alternates = { languages };
    }
    return entry;
  });
}
