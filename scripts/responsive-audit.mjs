/**
 * Responsive audit: loads every key route at phone/tablet/desktop widths and
 * fails (exit 1) if any page has horizontal overflow or is missing the
 * viewport meta. Run it against a live server before shipping layout or copy
 * changes — long localized strings are the usual overflow culprit.
 *
 *   npm run audit:responsive
 *
 * Env:
 *   AUDIT_BASE_URL  target server (default http://localhost:3000)
 *   CHROME_PATH     Chrome/Chromium executable (auto-detected when unset)
 */
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  // Windows
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean);

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) {
  console.error("No Chrome executable found. Set CHROME_PATH.");
  process.exit(2);
}

const PAGES = [
  "/",
  "/build",
  "/pricing",
  "/solutions",
  "/results",
  "/impact",
  "/services",
  "/process",
  "/connections",
  "/automations",
  "/automations/creator-brand-deal-and-sponsor-agent", // longest localized savings strings
  "/portal",
  "/es", // localization pass — longest strings live here
];

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812, isMobile: true, hasTouch: true },
  { name: "tablet", width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: "desktop", width: 1440, height: 900, isMobile: false, hasTouch: false },
];

// Fail fast with a clear message if the server isn't up.
try {
  await fetch(BASE, { signal: AbortSignal.timeout(5000) });
} catch {
  console.error(`No server responding at ${BASE} — start the dev server first (npm run dev).`);
  process.exit(2);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
let failures = 0;

for (const vp of VIEWPORTS) {
  await page.setViewport(vp);
  for (const path of PAGES) {
    try {
      await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 600));
      const report = await page.evaluate(() => {
        const doc = document.documentElement;
        const vw = doc.clientWidth;
        const overflowX = doc.scrollWidth - vw;
        const offenders = [];
        if (overflowX > 1) {
          for (const el of document.querySelectorAll("body *")) {
            const r = el.getBoundingClientRect();
            if (r.right > vw + 1) {
              const childFar = [...el.children].some((c) => c.getBoundingClientRect().right >= r.right - 1);
              if (!childFar) {
                offenders.push({
                  tag: el.tagName.toLowerCase(),
                  cls: String(el.className).slice(0, 80),
                  right: Math.round(r.right),
                });
                if (offenders.length >= 3) break;
              }
            }
          }
        }
        return { overflowX, offenders, meta: !!document.querySelector('meta[name="viewport"]') };
      });
      if (report.overflowX > 1 || !report.meta) {
        failures++;
        console.log(`FAIL ${vp.name.padEnd(7)} ${path} — overflowX=${report.overflowX}px meta=${report.meta}`);
        for (const o of report.offenders) console.log(`     <${o.tag}> right=${o.right} class="${o.cls}"`);
      } else {
        console.log(`ok   ${vp.name.padEnd(7)} ${path}`);
      }
    } catch (e) {
      failures++;
      console.log(`ERR  ${vp.name.padEnd(7)} ${path} — ${String(e).slice(0, 100)}`);
    }
  }
}

await browser.close();
console.log(`\n${failures === 0 ? "PASS" : "FAIL"} — ${failures} failing page×viewport combos of ${PAGES.length * VIEWPORTS.length}`);
process.exit(failures === 0 ? 0 : 1);
