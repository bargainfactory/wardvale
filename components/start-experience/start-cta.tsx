"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useStartExperience } from "./provider";

/**
 * Drop-in replacement for the site's primary CTAs: a button that opens the
 * Start experience modal, optionally pre-selecting an industry (bundle slug).
 * Works inside server-component pages as a client island.
 */
export function StartCTA({
  industry,
  children,
  ...props
}: { industry?: string; children: ReactNode } & Omit<ComponentProps<typeof Button>, "onClick">) {
  const { open } = useStartExperience();
  return (
    <Button onClick={() => open(industry)} {...props}>
      {children}
    </Button>
  );
}
