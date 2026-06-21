"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics/track";

// Envoie une vue de page à /api/track à chaque changement de route.
// Fire-and-forget (keepalive) — n'impacte jamais la navigation.
export function PageTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    if (pathname.startsWith("/admin") || pathname.startsWith("/tv")) return;
    last.current = pathname;
    track(pathname);
  }, [pathname]);

  return null;
}
