"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "ff_cookie_consent";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      // storage blocked — don't nag
    }
  }, []);

  function dismiss(value: "accepted" | "dismissed") {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* no-op */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl rounded-2xl glass-strong p-4 shadow-lg sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-xs text-muted-foreground">
          We use essential cookies to run this site and remember your theme &
          language. See our{" "}
          <Link href="/privacy" className="text-cyan-electric hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          onClick={() => dismiss("accepted")}
          className="shrink-0 rounded-full bg-gradient-to-r from-cyan-electric to-indigo-400 px-3 py-1.5 text-xs font-semibold text-navy-900"
        >
          Got it
        </button>
        <button
          aria-label="Dismiss"
          onClick={() => dismiss("dismissed")}
          className="shrink-0 rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
