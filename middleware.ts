import { NextResponse, type NextRequest } from "next/server";

// English is the default locale and lives at unprefixed URLs (/services).
// Other locales live under a prefix (/pt/services) so each language has its
// own crawlable URL. The active locale is passed to the app via the x-locale
// header, and x-pathname carries the locale-stripped path for hreflang.
const PREFIXED = ["es", "fr", "pt", "de"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const seg = pathname.split("/")[1] ?? "";

  // 1) Locale-prefixed URL → serve the underlying page with the locale header.
  if (PREFIXED.includes(seg)) {
    const stripped = pathname.slice(seg.length + 1) || "/";
    const url = req.nextUrl.clone();
    url.pathname = stripped;
    const headers = new Headers(req.headers);
    headers.set("x-locale", seg);
    headers.set("x-pathname", stripped);
    const res = NextResponse.rewrite(url, { request: { headers } });
    res.cookies.set("ff_locale", seg, { path: "/", maxAge: 31536000, sameSite: "lax" });
    return res;
  }

  // 2) Unprefixed URL → English by default, but honor a saved locale or, on a
  //    first visit, the browser's Accept-Language.
  const cookie = req.cookies.get("ff_locale")?.value;
  let target: string | null = null;
  if (cookie && PREFIXED.includes(cookie)) {
    target = cookie;
  } else if (!cookie) {
    const pref = (req.headers.get("accept-language") ?? "").split(",")[0]?.slice(0, 2).toLowerCase();
    if (pref && PREFIXED.includes(pref)) target = pref;
  }
  if (target) {
    const url = req.nextUrl.clone();
    url.pathname = `/${target}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const headers = new Headers(req.headers);
  headers.set("x-locale", "en");
  headers.set("x-pathname", pathname);
  const res = NextResponse.next({ request: { headers } });
  if (!cookie) res.cookies.set("ff_locale", "en", { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}

export const config = {
  // Skip API, auth callbacks, Next internals, and any file with an extension.
  matcher: ["/((?!api|auth|_next/static|_next/image|.*\\..*).*)"],
};
