"use client";

// First-party, cookieless-ish analytics + lightweight A/B experiments.
// Session id lives in localStorage (not a tracking cookie); events POST to
// /api/track. Everything is best-effort and silently no-ops on failure.

function sessionId(): string {
  try {
    let s = localStorage.getItem("ff_sid");
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("ff_sid", s);
    }
    return s;
  } catch {
    return "anonymous";
  }
}

/**
 * Sticky 50/50 experiment assignment, persisted per browser.
 * Same variant for the life of the visitor so exposure + conversion line up.
 */
export function getVariant(experiment = "hero"): "A" | "B" {
  try {
    const key = `ff_exp_${experiment}`;
    let v = localStorage.getItem(key) as "A" | "B" | null;
    if (v !== "A" && v !== "B") {
      v = Math.random() < 0.5 ? "A" : "B";
      localStorage.setItem(key, v);
    }
    return v;
  } catch {
    return "A";
  }
}

export function track(name: string, props: Record<string, unknown> = {}) {
  try {
    const payload = JSON.stringify({
      name,
      props,
      sessionId: sessionId(),
      variant: getVariant(),
      path: typeof location !== "undefined" ? location.pathname : undefined,
    });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* never throw from analytics */
  }
}
