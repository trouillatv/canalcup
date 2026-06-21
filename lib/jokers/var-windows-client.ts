// Récupère (partagé entre toutes les cartes) les match_id où l'utilisateur a une
// fenêtre VAR active. Cache court (TTL) pour refléter un joker VAR joué EN COURS
// de session sans recharger toute la page. force=true ignore le cache.
let cache: Promise<Set<string>> | null = null;
let at = 0;
const TTL = 15_000;

export function getVarWindowMatchIds(force = false): Promise<Set<string>> {
  if (force || !cache || Date.now() - at > TTL) {
    at = Date.now();
    cache = fetch("/api/jokers/var-windows", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { matchIds: [] }))
      .then((d) => new Set<string>(d.matchIds ?? []))
      .catch(() => new Set<string>());
  }
  return cache;
}
