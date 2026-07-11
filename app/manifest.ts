import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FlowForge AI — Automation for Small Business",
    short_name: "FlowForge",
    description: "Done-for-you Zapier flows and custom GPT agents. Scope an automation in 60 seconds.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#050a14",
    theme_color: "#050a14",
    orientation: "portrait",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
