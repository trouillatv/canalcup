"use client";

// 🔴 Badge d'icône PWA (chiffre sur l'icône de l'app).
// Reflète le nombre de pronos « à faire » (matchs ouverts imminents non joués),
// via l'API Badging (navigator.setAppBadge). Fonctionne sur PWA installée :
// iOS 16.4+, Android (Chrome), desktop. Ignoré silencieusement ailleurs.
//
// Mise à jour : au montage, quand l'app revient au premier plan (retour depuis
// l'arrière-plan), et toutes les 5 min tant qu'elle est ouverte. Le badge est
// donc frais dès que l'utilisateur regarde son téléphone après avoir ouvert
// l'app au moins une fois.

import { useEffect } from "react";

const REFRESH_MS = 5 * 60 * 1000;

export function AppBadge() {
  useEffect(() => {
    // Feature-detection : rien à faire si l'API Badging n'existe pas.
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.setAppBadge !== "function") return;

    let cancelled = false;

    const apply = async () => {
      try {
        const r = await fetch("/api/me/badge", { credentials: "same-origin", cache: "no-store" });
        if (!r.ok || cancelled) return;
        const { count } = (await r.json()) as { count?: number };
        if (cancelled) return;
        if (count && count > 0) await nav.setAppBadge!(count);
        else await nav.clearAppBadge?.();
      } catch {
        /* silencieux : le badge est un bonus, jamais bloquant */
      }
    };

    apply();

    const onVisible = () => {
      if (document.visibilityState === "visible") apply();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(apply, REFRESH_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);

  return null;
}
