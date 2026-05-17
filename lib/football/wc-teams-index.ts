// ─────────────────────────────────────────────────────────────────────────────
//  Index léger { name → slug } — sûr côté client (composants "use client").
//  N'embarque PAS les effectifs : utilisé uniquement pour décider si une
//  équipe est cliquable et construire le lien vers sa fiche.
//  Source : data/wc-teams-index.json (généré par scripts/parse-wc-teams.js).
// ─────────────────────────────────────────────────────────────────────────────

import index from "@/data/wc-teams-index.json";

// Noms utilisés ailleurs (poules officielles, pronostics) ≠ noms docs.
const NAME_ALIASES: Record<string, string> = {
  "République Tchèque": "Tchéquie",
  "México": "Mexique",
  "Nigéria": "Nigeria",
  Colombia: "Colombie",
  USA: "États-Unis",
  "United States": "États-Unis",
};

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const SLUG_SET = new Set((index as { name: string; slug: string }[]).map((t) => t.slug));

/** Lien vers la fiche de l'équipe, ou null si aucune donnée docs. */
export function wcTeamHref(name: string): string | null {
  if (!name) return null;
  const slug = slugify(NAME_ALIASES[name] ?? name);
  return SLUG_SET.has(slug) ? `/wc-team/${slug}` : null;
}
