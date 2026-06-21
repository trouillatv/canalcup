"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Envoie une vue de page à /api/track à chaque changement de route.
// Fire-and-forget (keepalive) — n'impacte jamais la navigation.
export function PageTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    if (pathname.startsWith("/admin") || pathname.startsWith("/tv")) return;
    last.current = pathname;
    try {
      const body = JSON.stringify({ path: pathname });
      // sendBeacon si dispo (fiable au unload), sinon fetch keepalive.
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch { /* silencieux */ }
  }, [pathname]);

  return null;
}
