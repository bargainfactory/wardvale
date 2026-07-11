"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

/** Fires a first-party pageview on every route change. */
export function AnalyticsProvider() {
  const pathname = usePathname();
  useEffect(() => {
    track("pageview", { path: pathname });
  }, [pathname]);
  return null;
}
