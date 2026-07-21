import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-ssr";
import { safeInternalPath } from "@/lib/paths";

/**
 * Magic-link callback. Handles both flows Supabase may use:
 * - PKCE `code` → exchangeCodeForSession
 * - `token_hash` + `type` → verifyOtp
 * On success, session cookies are set and we redirect into the portal.
 * On failure the login page gets a reason (`expired` vs generic) plus the
 * original `next`, so a retried sign-in still lands on the deep link.
 */

function isExpired(error: { code?: string; message: string }): boolean {
  return error.code === "otp_expired" || /expired/i.test(error.message);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeInternalPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Supabase can also bounce its own errors straight to this URL.
  let expired = searchParams.get("error_code") === "otp_expired";

  const supabase = await createServerSupabase();
  if (supabase) {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
      expired = expired || isExpired(error);
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(`${origin}${next}`);
      expired = expired || isExpired(error);
    }
  }

  const reason = expired ? "expired" : "1";
  return NextResponse.redirect(`${origin}/portal/login?error=${reason}&next=${encodeURIComponent(next)}`);
}
