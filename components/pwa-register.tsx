"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in PRODUCTION only. A service worker in
 * development caches dev chunks and fights HMR/hydration, so in dev we instead
 * proactively unregister any existing one — self-healing a stale SW left over
 * from a prior run on this port.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
  }, []);
  return null;
}
