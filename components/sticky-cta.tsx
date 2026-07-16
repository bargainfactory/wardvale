"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import { useStartExperience } from "@/components/start-experience/provider";

/**
 * Floating launcher for the unified Start experience. (Previously a 4-step
 * mini-quiz — retired in favor of the single industry→questionnaire→booking
 * flow, so there's one consistent funnel across the site.)
 */
export function StickyCTA() {
  const { t } = useLocale();
  const { open: openStart } = useStartExperience();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-1.5"
        >
          <Button size="lg" className="gap-2 shadow-glow-lg" onClick={() => openStart()}>
            <Sparkles className="h-4 w-4" />
            {t("sticky.audit")}
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={t("start.close")}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-navy-900/80 text-muted-foreground backdrop-blur transition hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
