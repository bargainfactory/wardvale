"use client";

import { useEffect, useState } from "react";

/**
 * Returns false during SSR and the first client render, then true after mount.
 *
 * Used to gate framer-motion enter reveals: on the server and first paint we
 * pass `initial={false}` so content renders at its VISIBLE target (no blank
 * hero if the enter animation doesn't fire — which it doesn't reliably under
 * React 19.0.0 + framer-motion 11 for mount/whileInView reveals). Once the app
 * is interactive, client-side navigations mount fresh with `mounted === true`,
 * so the fade/slide-in still plays. Net: content is never invisible, and the
 * motion design is preserved on navigation and on-scroll reveals.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
