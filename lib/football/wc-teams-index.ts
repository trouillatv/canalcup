// ─────────────────────────────────────────────────────────────────────────────
//  Index léger { name → slug } — sûr côté client (composants "use client").
//  N'embarque PAS les effectifs : utilisé uniquement pour décider si une
//  équipe est cliquable et construire le lien vers sa fiche.
//  Source : data/wc-teams-index.json (généré par scripts/parse-wc-teams.js).
// ─────────────────────────────────────────────────────────────────────────────

import index from "@/data/wc-teams-index.json";
import { WC2026_GROUPS } from "@/lib/football/groups-2026";
import { getFIFARank } from "@/lib/football/fifa-ranks";

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

/** Lien vers la vue condensée tournoi (/football/teams/[slug]) — matchs, stats, groupe. */
export function wcTeamHref(name: string): string | null {
  if (!name) return null;
  const slug = slugify(NAME_ALIASES[name] ?? name);
  return SLUG_SET.has(slug) ? `/football/teams/${slug}` : null;
}

/** Lien vers la fiche effectif (/wc-team/[slug]) — effectif, forme, calendrier. */
export function wcTeamFicheHref(name: string): string | null {
  if (!name) return null;
  const slug = slugify(NAME_ALIASES[name] ?? name);
  return SLUG_SET.has(slug) ? `/wc-team/${slug}` : null;
}

/** Liste des 48 sélections qualifiées, triées par ordre alphabétique français. */
export function allWCTeamsFiche(): Array<{ name: string; slug: string; group: string; fifaRank: number | null }> {
  return WC2026_GROUPS
    .flatMap((g) =>
      g.teams.map((t) => {
        const canonical = NAME_ALIASES[t] ?? t;
        const slug = slugify(canonical);
        const entry = getFIFARank(canonical) ?? getFIFARank(t);
        return { name: canonical, slug, group: g.letter, fifaRank: entry?.rank ?? null };
      })
    )
    .filter((t) => SLUG_SET.has(t.slug))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
