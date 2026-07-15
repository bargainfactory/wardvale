import type { NextConfig } from "next";

// Content-Security-Policy.
// - 'unsafe-inline' for scripts is required because Next injects inline
//   bootstrap scripts (and we render inline JSON-LD) without a nonce.
// - Font/style hosts cover rsms.me (Inter) and Fontshare (Satoshi).
// - Cloudflare hosts cover the optional Turnstile CAPTCHA widget.
// Supabase is called from the browser (auth + realtime), so its origin must be
// allowed for fetch (https) and websockets (wss); derived from the public URL.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWss = supabaseUrl.replace(/^https:/, "wss:");

// In development, Next's React Fast Refresh + webpack runtime evaluate code via
// eval(), and HMR runs over a websocket. Those need 'unsafe-eval' and a ws:
// connect source — WITHOUT them the CSP blocks the entire client bundle, so the
// app never hydrates (blank client pages, dead buttons). Production builds don't
// use eval, so we keep the prod policy strict and only relax it in dev.
const isDev = process.env.NODE_ENV !== "production";

const scriptSrc = ["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com"];
if (isDev) scriptSrc.push("'unsafe-eval'");

const connectHosts = [
  "'self'",
  "https://challenges.cloudflare.com",
  supabaseUrl,
  supabaseWss,
  ...(isDev ? ["ws:", "wss:"] : []),
]
  .filter(Boolean)
  .join(" ");

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://rsms.me https://api.fontshare.com",
  "font-src 'self' data: https://rsms.me https://cdn.fontshare.com https://api.fontshare.com",
  "img-src 'self' data: https:",
  `connect-src ${connectHosts}`,
  "frame-src https://challenges.cloudflare.com https://calendly.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microphone=(self) so the voice-input feature (Web Speech API) works.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
