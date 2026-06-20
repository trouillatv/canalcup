// Types & helpers PURS de la fiche joueur football (importables client + serveur).
// La logique serveur (DB, API, clé) vit dans player-card.ts (server-only).

export interface PlayerMeta {
  club: string | null;
  value: string | null;       // valeur marchande Transfermarkt (ex. "€120m")
  positionFr: string | null;  // poste en français (Gardien/Défenseur/…)
  number: number | null;
  caps: number | null;
  selectionGoals: number | null;
  teamName: string | null;    // sélection nationale
  teamSlug: string | null;    // → /wc-team/[slug]
}

export interface PlayerBio {
  name: string;
  firstname: string | null;
  lastname: string | null;
  age: number | null;
  birthDate: string | null;
  birthPlace: string | null;
  nationality: string | null;
  height: string | null;
  weight: string | null;
  number: number | null;
  position: string | null;
  photo: string | null;
}

export interface PlayerFormMatch {
  matchId: string;
  date: string;
  teamA: string;
  teamB: string;
  flagA: string | null;
  flagB: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: string | null;
  isHome: boolean;
  rating: number | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutes: number | null;
  started: boolean | null;
  shots: number;
  keyPasses: number | null;
  duelsWon: number | null;
  dribbles: number;
}

export interface WCAggregate {
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  avgRating: number | null;
}

export interface DangerIndex {
  score: number;
  emoji: string;
  label: string;
  confident: boolean;
}

export interface RelatedPlayer {
  id: string;
  name: string;
  photo: string;
  positionFr: string | null;
}

// Joueur classé (Top forme Mondial, chauds/froids d'un match).
export interface RankedPlayer {
  id: string;
  name: string;
  photo: string;
  teamName: string | null;
  teamSlug: string | null;
  positionFr: string | null;
  avgRating: number | null;
  matches: number;
  goals: number;
  assists: number;
  danger?: number;       // Indice Dangerosité 0-100 (chauds/froids)
}

// Stats saison par compétition (API /players?id=&season=) — récupérées à la
// demande + cachées, jamais stockées. Donnée (pas IA) → coût quasi nul.
export interface SeasonCompetition {
  league: string;
  country: string | null;
  team: string | null;
  appearances: number;
  lineups: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating: number | null;
}
export interface SeasonStats {
  label: string;                  // ex. "2025-26"
  competitions: SeasonCompetition[];
  totals: { appearances: number; goals: number; assists: number; minutes: number; rating: number | null };
}

export interface PlayerCard {
  id: string;
  bio: PlayerBio | null;
  meta: PlayerMeta | null;
  form: PlayerFormMatch[];
  formAvg: number | null;
  wc: WCAggregate;
  season: SeasonStats | null;  // 📊 saison club par compétition (API cachée)
  danger: DangerIndex | null;
  related: RelatedPlayer[];   // mêmes sélection (curiosité / navigation)
  facts: string[];            // 💡 « Le saviez-vous » dérivés de nos données
  notFound: boolean;
}

export type RatingTier = "good" | "ok" | "low" | "none";

export function ratingTier(r: number | null | undefined): RatingTier {
  if (r == null) return "none";
  if (r >= 7) return "good";
  if (r >= 6) return "ok";
  return "low";
}

// Classes Tailwind pour une pastille de note (cohérent avec le terrain/notes).
export function ratingPillClass(r: number | null | undefined): string {
  switch (ratingTier(r)) {
    case "good": return "bg-green-500/20 text-green-400 border border-green-500/40";
    case "ok": return "bg-canal-yellow/15 text-canal-yellow border border-canal-yellow/30";
    case "low": return "bg-red-500/15 text-red-400 border border-red-500/30";
    default: return "bg-canal-gray-mid text-canal-gray-muted";
  }
}

// Pastille de forme (point plein coloré).
export function formDotClass(r: number | null | undefined): string {
  switch (ratingTier(r)) {
    case "good": return "bg-green-500";
    case "ok": return "bg-canal-yellow";
    case "low": return "bg-red-500";
    default: return "bg-canal-gray-light";
  }
}
