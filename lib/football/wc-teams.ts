// ─────────────────────────────────────────────────────────────────────────────
//  Accès aux données « sélections nationales » issues de docs/*.txt.
//  Source : data/wc-teams.json (généré par scripts/parse-wc-teams.js).
//
//  On garde les poules officielles de l'app (groups-2026.ts) intactes : ce
//  module sert uniquement à afficher la fiche détaillée d'une équipe au clic.
// ─────────────────────────────────────────────────────────────────────────────

import rawData from "@/data/wc-teams.json";

export interface WCPlayer {
  name: string;
  position: string | null;
  club: string | null;
  value: string | null;
}

export interface WCTeam {
  name: string;
  slug: string;
  group: string | null;
  squadValue: string | null;
  form: string[];
  nextMatch: string | null;
  recentScores: string[];
  calendar: string[];
  players: WCPlayer[];
}

const TEAMS = rawData as WCTeam[];

// Index par slug (clé de route).
const BY_SLUG = new Map<string, WCTeam>(TEAMS.map((t) => [t.slug, t]));

// Noms utilisés ailleurs dans l'app (poules officielles, pronostics) qui
// diffèrent de ceux du docs. Clé = nom app, valeur = nom canonique docs.
const NAME_ALIASES: Record<string, string> = {
  "République Tchèque": "Tchéquie",
  "Tchéquie": "Tchéquie",
  "México": "Mexique",
  "Nigéria": "Nigeria",
  "Colombia": "Colombie",
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

// Index par slug du nom canonique (après application des alias).
const BY_NAME_SLUG = new Map<string, WCTeam>();
for (const t of TEAMS) BY_NAME_SLUG.set(slugify(t.name), t);

/** Fiche d'une équipe à partir de son slug de route. */
export function getWCTeamBySlug(slug: string): WCTeam | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Fiche d'une équipe à partir d'un nom (app ou docs). null si absente. */
export function getWCTeamByName(name: string): WCTeam | null {
  if (!name) return null;
  const canonical = NAME_ALIASES[name] ?? name;
  return BY_NAME_SLUG.get(slugify(canonical)) ?? null;
}

/** true si une fiche docs existe pour ce nom — pour ne pas créer de lien mort. */
export function hasWCTeam(name: string): boolean {
  return getWCTeamByName(name) !== null;
}

/** Lien vers la fiche, ou null si aucune donnée pour cette équipe. */
export function wcTeamHref(name: string): string | null {
  const team = getWCTeamByName(name);
  return team ? `/wc-team/${team.slug}` : null;
}

/** Tous les slugs (génération statique des pages). */
export function allWCTeamSlugs(): string[] {
  return TEAMS.map((t) => t.slug);
}

/** Code résultat d'une entrée de forme : "Victoire (TAB)" → "V". */
export function formCode(entry: string): "V" | "N" | "D" | "?" {
  const e = entry.toLowerCase();
  if (e.startsWith("victoire")) return "V";
  if (e.startsWith("nul")) return "N";
  if (e.startsWith("défaite") || e.startsWith("defaite")) return "D";
  return "?";
}
