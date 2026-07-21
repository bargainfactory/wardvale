import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/** True when Supabase Auth is configured (anon key present). */
export function isSupabaseAuthConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Cookie-bound Supabase client for Server Components / Route Handlers.
 * Returns null when unconfigured so callers fall back to the demo view.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set({ name, value, ...options }));
        } catch {
          // Called from a Server Component render — cookies are read-only here.
          // Session refresh still happens on route handlers / the auth callback.
        }
      },
    },
  });
}

/**
 * The signed-in user's email, or null (unconfigured / not signed in).
 * Lowercased: every write path (provisioning, Stripe webhook) lowercases
 * before storing, so this single read seam must match — a mixed-case JWT
 * email would otherwise silently miss the client row.
 */
export async function getPortalUserEmail(): Promise<string | null> {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}
