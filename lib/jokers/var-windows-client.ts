// Récupère (une seule fois, partagé entre toutes les cartes) les match_id où
// l'utilisateur a une fenêtre VAR active. Évite N requêtes pour N MatchCard.
let cache: Promise<Set<string>> | null = null;

export function getVarWindowMatchIds(): Promise<Set<string>> {
  if (!cache) {
    cache = fetch("/api/jokers/var-windows", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { matchIds: [] }))
      .then((d) => new Set<string>(d.matchIds ?? []))
      .catch(() => new Set<string>());
  }
  return cache;
}
