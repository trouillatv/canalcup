// Envoi d'un évènement d'usage à /api/track (fire-and-forget).
// Utilisé pour les vues de page ET les onglets (path "/matches/[id]#notes").
export function track(path: string) {
  try {
    const body = JSON.stringify({ path });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch { /* silencieux — ne jamais bloquer l'UI */ }
}
