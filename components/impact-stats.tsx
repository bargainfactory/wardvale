"use client";

import { useEffect, useRef, useState } from "react";

type Stat = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
};

const DURATION = 1200;

// Ease-out cubic for a snappy start that settles smoothly on the final value.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function StatTile({ stat }: { stat: Stat }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      setDisplay(stat.value * easeOutCubic(progress));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(stat.value);
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [stat.value]);

  const rounded = Math.round(display);

  return (
    <div className="rounded-3xl glass p-6">
      <p className="font-display text-4xl font-semibold tabular-nums gradient-text">
        {stat.prefix ?? ""}
        {rounded.toLocaleString()}
        {stat.suffix ?? ""}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
    </div>
  );
}

export function ImpactStats({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <StatTile key={stat.label} stat={stat} />
      ))}
    </div>
  );
}
