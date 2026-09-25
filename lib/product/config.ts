// Config produit centralisée — CANAL Sports.
//
// Objectif : un seul endroit pour l'identité produit, le fuseau par défaut
// et le sport/compétition par défaut, afin de réduire au fil du temps les
// constantes éparpillées (CANAL CUP, WORLD CUP 2026, WC_START, etc.).
//
// Ce fichier ne remplace PAS encore les constantes existantes de Canal Cup
// (lib/tournament.ts, lib/football/*) — ce grand remplacement est un
// chantier P2/P3, pas un search/replace fait à la volée ici. Il sert de
// point d'ancrage pour tout le code NEUF (CANAL Sports).

export type SportSlug = "football" | "f1" | "rugby" | "motogp";

export interface ProductConfig {
  /** Nom produit affiché (titre, manifest, métadonnées). Pas encore figé. */
  name: string;
  shortName: string;
  tagline: string;
  /**
   * Fuseau horaire par défaut pour l'affichage quand l'utilisateur n'a pas
   * (encore) de préférence enregistrée. Ne JAMAIS coder un offset fixe
   * (type +11) dans un calcul — toujours passer par Intl/date-fns-tz avec
   * cet identifiant IANA.
   */
  defaultTimezone: string;
  /** Sport actif par défaut tant qu'un seul sport est branché (pilote CL). */
  defaultSport: SportSlug;
  /** Slug de la compétition pilote (Champions League), pas encore un id DB. */
  defaultCompetitionSlug: string;
}

export const productConfig: ProductConfig = {
  name: "CANAL Sports",
  shortName: "CANAL Sports",
  tagline: "Pronostics, programme et briefs pour toutes les compétitions CANAL+",
  defaultTimezone: "Pacific/Noumea",
  defaultSport: "football",
  defaultCompetitionSlug: "champions-league",
};
