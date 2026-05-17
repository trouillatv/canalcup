"use client";

import { useEffect, useState } from "react";

interface Props {
  startsAt: string;
  onExpire?: () => void;
}

export function Countdown({ startsAt, onExpire }: Props) {
  const [diff, setDiff] = useState(() => new Date(startsAt).getTime() - Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date(startsAt).getTime() - Date.now();
      setDiff(d);
      if (d <= 0) {
        clearInterval(t);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [startsAt, onExpire]);

  if (diff <= 0 || diff > 48 * 3600_000) return null;

  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);

  const isImminent = diff < 15 * 60_000; // < 15 min

  return (
    <span
      className={`font-black tabular-nums text-sm ${
        isImminent ? "text-red-400 animate-pulse" : "text-canal-yellow"
      }`}
    >
      {h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`}
    </span>
  );
}
