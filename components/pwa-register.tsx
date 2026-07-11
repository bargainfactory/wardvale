"use client";

import { useEffect } from "react";

/** Registers the service worker so the site is installable + offline-capable. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
