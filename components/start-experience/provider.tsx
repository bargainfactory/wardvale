"use client";

import { createContext, useCallback, useContext, useEffect, useState, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { Dialog } from "@/components/ui/dialog";
import { useLocale } from "@/lib/locale-context";
import { StartFlow } from "./start-flow";

type StartCtx = { open: (industry?: string) => void; close: () => void };

const Ctx = createContext<StartCtx>({ open: () => {}, close: () => {} });

/** Any CTA anywhere on the site can launch the flow via useStartExperience().open(slug?). */
export function useStartExperience(): StartCtx {
  return useContext(Ctx);
}

export function StartExperienceProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [industry, setIndustry] = useState("");

  const openFn = useCallback((slug?: string) => {
    setIndustry(slug ?? "");
    setOpen(true);
  }, []);
  const closeFn = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ open: openFn, close: closeFn }}>
      {/* Respect prefers-reduced-motion app-wide: framer-motion transform/layout
          animations are disabled for users who ask for reduced motion. */}
      <MotionConfig reducedMotion="user">
        {children}
        {/* Deep link: /any/path?start=1&industry=<slug> auto-opens (shareable, SSR links). */}
        <Suspense fallback={null}>
          <DeepLink onOpen={openFn} />
        </Suspense>
        <Dialog open={open} onClose={closeFn} label={t("start.dialogLabel")} closeLabel={t("start.close")} className="max-w-6xl">
          {open && <StartFlow key={industry || "pick"} initialIndustry={industry} />}
        </Dialog>
      </MotionConfig>
    </Ctx.Provider>
  );
}

function DeepLink({ onOpen }: { onOpen: (slug?: string) => void }) {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("start") === "1") onOpen(params.get("industry") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
