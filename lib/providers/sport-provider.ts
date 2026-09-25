// Contrat générique "fournisseur de données sportives" — indépendant du
// sport et du fournisseur. Voir docs/adr/0003-sport-provider-abstraction.md.
//
// Principe : CANAL Sports ne dépend jamais directement d'un fournisseur
// (contrairement à Canal Cup, couplé en dur à API-Football — voir
// lib/football/*, legacy, non touché). Les DTOs ci-dessous ne sont PAS le
// schéma de la base (voir
// supabase/migrations-canal-sports/20260925000000_referential_sport_model.sql)
// — c'est la forme normalisée que RENVOIE un provider. Une couche
// d'ingestion (pas encore écrite, hors scope de ce lot) upsert ces DTOs via
// (source, external_id). `external_id` est TOUJOURS un identifiant du
// fournisseur, jamais l'identité interne CANAL Sports (`id` uuid en base).

export type ProviderEventStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

// Une capability déclarée à `true` signifie "ce provider expose cette
// donnée d'après sa documentation / son plan". Ce n'est pas une garantie
// d'exactitude à l'exécution — voir docs/poc-football-providers-cl-2026-27.md
// pour ce qui a été réellement vérifié en conditions réelles.
export interface ProviderCapabilities {
  competitions: boolean;
  seasons: boolean;
  participants: boolean;
  fixtures: boolean;
  status: boolean;
  live: boolean;
  scores: boolean;
  standings: boolean;
  events: boolean;
  lineups: boolean;
  statistics: boolean;
}

export interface ProviderRef {
  /** Slug stable du fournisseur, ex. "football-data.org", "api-football". */
  source: string;
  /** Identifiant tel que renvoyé par CE fournisseur — jamais l'id interne CANAL Sports. */
  external_id: string;
}

export interface ProviderCompetition extends ProviderRef {
  name: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderSeason extends ProviderRef {
  competition_external_id: string;
  label: string;
  starts_at?: string;
  ends_at?: string;
}

export interface ProviderParticipant extends ProviderRef {
  type: "team" | "individual";
  name: string;
  short_name?: string;
  country?: string;
  logo_url?: string;
}

export interface ProviderEventParticipantRef {
  participant_external_id: string;
  /** Libre : "home"/"away" pour un sport à 2 camps, position de départ pour une course, etc. */
  role?: string;
}

export interface ProviderEvent extends ProviderRef {
  season_external_id: string;
  starts_at: string;
  venue?: string;
  status: ProviderEventStatus;
  stage?: string;
  stage_order?: number;
  matchday?: number;
  leg?: number;
  participants: ProviderEventParticipantRef[];
  result?: Record<string, unknown>;
}

export interface ProviderStandingRow {
  participant_external_id: string;
  position: number;
  points?: number;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  /** Sport-spécifique : buts marqués/encaissés, écart de points rugby, etc. */
  extra?: Record<string, unknown>;
}

export interface ProviderStandings {
  season_external_id: string;
  /** Libre, tel que publié par le fournisseur : "League phase", "Group A"... */
  group?: string;
  rows: ProviderStandingRow[];
}

// Contrat commun à tout fournisseur, quel que soit le sport. Les méthodes
// optionnelles ne doivent être appelées que si `capabilities.<x>` est vrai
// — voir hasCapability() ci-dessous. Un provider "football" implémente
// FootballProvider (./football-provider.ts), qui étend ce contrat.
export interface SportProvider {
  /** Slug stable, identique à ProviderRef.source pour tous les DTOs qu'il émet. */
  readonly id: string;
  /** "football", "f1", "rugby"... — un provider sert un seul sport. */
  readonly sport: string;
  readonly capabilities: ProviderCapabilities;

  getCompetitions(): Promise<ProviderCompetition[]>;
  getSeasons(competitionExternalId: string): Promise<ProviderSeason[]>;
  getParticipants(seasonExternalId: string): Promise<ProviderParticipant[]>;
  getEvents(seasonExternalId: string): Promise<ProviderEvent[]>;

  getStandings?(seasonExternalId: string): Promise<ProviderStandings[]>;
}

/**
 * Garde-fou : le reste de CANAL Sports ne doit jamais appeler une méthode
 * optionnelle (getStandings, ou les extensions sport-spécifiques comme
 * getLineups) sans être passé par ce check — sinon on retombe dans le biais
 * "on suppose que toutes les capabilities existent".
 */
export function hasCapability<K extends keyof ProviderCapabilities>(
  provider: SportProvider,
  capability: K
): boolean {
  return provider.capabilities[capability] === true;
}
