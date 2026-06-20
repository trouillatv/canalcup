// ─────────────────────────────────────────────────────────────────────────────
//  Fiche joueur football — couche données (SERVEUR UNIQUEMENT).
//
//  Mélange Sofascore + Transfermarkt + Football Manager, recadré sur ce que
//  notre API/forfait fournit VRAIMENT (cf. audit) :
//   • bio (âge, taille, poids, nationalité, poste, n°)  → API /players/profiles
//   • club + valeur marchande (absents d'API-Football)   → data/wc-teams.json (TM)
//   • forme, Mondial, derniers matchs                    → player_match_stats (DB)
//   • Indice Dangerosité (0-100)                         → dérivé des stats récentes
//
//  Ne JAMAIS importer depuis un composant client (clé API + service_role).
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import rawData from "@/data/wc-teams.json";
import { toFrench } from "@/lib/football/team-names";
import type {
  PlayerMeta, PlayerBio, PlayerFormMatch, WCAggregate, DangerIndex, PlayerCard,
} from "@/lib/football/player-card-types";

export type { PlayerMeta, PlayerBio, PlayerFormMatch, WCAggregate, DangerIndex, PlayerCard };

const APIF = "https://v3.football.api-sports.io";
const hasApiFootball = () => !!process.env.API_FOOTBALL_KEY;

// ─── Index wc-teams.json par api_football_id (club + valeur Transfermarkt) ─────

interface RawWCPlayer {
  name: string;
  position: string | null;
  club: string | null;
  value: string | null;
  caps?: number | null;
  selection_goals?: number | null;
  age?: number | null;
  api_football_id?: number;
  number?: number;
  photo?: string;
}
interface RawWCTeam {
  name: string;
  slug: string;
  players: RawWCPlayer[];
}

const META_BY_ID = new Map<string, PlayerMeta>();
for (const t of rawData as RawWCTeam[]) {
  for (const p of t.players ?? []) {
    if (p.api_football_id == null) continue;
    META_BY_ID.set(String(p.api_football_id), {
      club: p.club ?? null,
      value: p.value ?? null,
      positionFr: p.position ?? null,
      number: p.number ?? null,
      caps: p.caps ?? null,
      selectionGoals: p.selection_goals ?? null,
      teamName: t.name,
      teamSlug: t.slug,
    });
  }
}

// ─── API : bio ─────────────────────────────────────────────────────────────────

async function fetchBio(playerId: string): Promise<PlayerBio | null> {
  if (!hasApiFootball()) return null;
  try {
    const res = await fetch(`${APIF}/players/profiles?player=${playerId}`, {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY! },
      // Bio quasi statique : cache long (24 h).
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const p = json?.response?.[0]?.player;
    if (!p) return null;
    return {
      name: p.name ?? "",
      firstname: p.firstname ?? null,
      lastname: p.lastname ?? null,
      age: p.age ?? null,
      birthDate: p.birth?.date ?? null,
      birthPlace: p.birth?.place ?? null,
      nationality: p.nationality ?? null,
      height: p.height ? String(p.height).replace(/[^\d]/g, "") || null : null,
      weight: p.weight ? String(p.weight).replace(/[^\d]/g, "") || null : null,
      number: p.number ?? null,
      position: p.position ?? null,
      photo: p.photo ?? `https://media.api-sports.io/football/players/${playerId}.png`,
    };
  } catch {
    return null;
  }
}

// ─── Indice Dangerosité (0-100) ─────────────────────────────────────────────────
//
// Sur les matchs RÉELLEMENT joués parmi les 5 derniers :
//   note    = clamp((moyNote − 5)/4, 0, 1) × 45      (5.0→0, 9.0→45)
//   attaque = min(1, (buts + passes×0.6 + tirs×0.15 + passesClés×0.1)/match) × 40
//   jeu     = (minutesMoy/90) × ratioTitu × 15
// Si aucune note dispo (l'API ne note pas toujours le Mondial) : l'indice
// bascule sur attaque+jeu seuls (re-pondérés) et `confident` passe à false.

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

function computeDanger(played: PlayerFormMatch[]): DangerIndex | null {
  if (!played.length) return null;
  const n = played.length;
  const ratings = played.map((m) => m.rating).filter((r): r is number => r != null);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  const goals = played.reduce((a, m) => a + m.goals, 0);
  const assists = played.reduce((a, m) => a + m.assists, 0);
  const shots = played.reduce((a, m) => a + m.shots, 0);
  const keyPasses = played.reduce((a, m) => a + (m.keyPasses ?? 0), 0);
  const attackRaw = (goals + assists * 0.6 + shots * 0.15 + keyPasses * 0.1) / n;
  const attack01 = clamp01(attackRaw); // 1 implication décisive/match ≈ plafond

  const minutesVals = played.map((m) => m.minutes).filter((x): x is number => x != null);
  const avgMinutes = minutesVals.length ? minutesVals.reduce((a, b) => a + b, 0) / minutesVals.length : 60;
  const startsRatio = played.filter((m) => m.started).length / n;
  const play01 = clamp01(avgMinutes / 90) * Math.max(startsRatio, 0.2);

  let score: number;
  let confident: boolean;
  if (avgRating != null) {
    const note = clamp01((avgRating - 5) / 4) * 45;
    score = note + attack01 * 40 + play01 * 15;
    confident = ratings.length >= 2;
  } else {
    // Sans note : attaque + jeu re-pondérés (plafond plus bas, signal incertain).
    score = attack01 * 55 + play01 * 25;
    confident = false;
  }
  score = Math.round(Math.max(0, Math.min(100, score)));

  let emoji = "😴", label = "Peu impliqué récemment";
  if (score >= 85) { emoji = "🔥"; label = "Très forte probabilité d'être décisif"; }
  else if (score >= 60) { emoji = "⚡"; label = "Joueur dangereux, à surveiller"; }
  else if (score >= 40) { emoji = "🙂"; label = "Contribution correcte"; }

  return { score, emoji, label, confident };
}

// ─── Entrée principale ──────────────────────────────────────────────────────────

export async function getPlayerCard(playerId: string): Promise<PlayerCard> {
  const meta = META_BY_ID.get(playerId) ?? null;
  const supabase = createAdminClient();

  type Row = {
    match_id: string;
    team_side: "home" | "away";
    rating: number | null;
    goals: number; assists: number;
    yellow_cards: number; red_cards: number;
    shots: number; dribbles: number;
    minutes: number | null; started: boolean | null;
    key_passes: number | null; duels_won: number | null;
    match: {
      team_a: string; team_b: string;
      flag_a: string | null; flag_b: string | null;
      score_a: number | null; score_b: number | null;
      starts_at: string; status: string | null; competition: string | null;
    } | null;
  };

  const [bio, statsRes] = await Promise.all([
    fetchBio(playerId),
    supabase
      .from("player_match_stats")
      .select(
        "match_id, team_side, rating, goals, assists, yellow_cards, red_cards, shots, dribbles, minutes, started, key_passes, duels_won, " +
          "match:matches(team_a, team_b, flag_a, flag_b, score_a, score_b, starts_at, status, competition)"
      )
      .eq("player_id", playerId),
  ]);

  const rows = ((statsRes.data ?? []) as unknown as Row[])
    .filter((r) => r.match)
    .sort((a, b) => new Date(b.match!.starts_at).getTime() - new Date(a.match!.starts_at).getTime());

  const allMatches: PlayerFormMatch[] = rows.map((r) => {
    const m = r.match!;
    const isHome = r.team_side === "home";
    return {
      matchId: r.match_id,
      date: m.starts_at,
      teamA: toFrench(m.team_a),
      teamB: toFrench(m.team_b),
      flagA: m.flag_a, flagB: m.flag_b,
      scoreA: m.score_a, scoreB: m.score_b,
      status: m.status,
      isHome,
      rating: r.rating,
      goals: r.goals ?? 0,
      assists: r.assists ?? 0,
      yellowCards: r.yellow_cards ?? 0,
      redCards: r.red_cards ?? 0,
      minutes: r.minutes ?? null,
      started: r.started ?? null,
      shots: r.shots ?? 0,
      keyPasses: r.key_passes ?? null,
      duelsWon: r.duels_won ?? null,
      dribbles: r.dribbles ?? 0,
    };
  });

  // Forme = derniers matchs où le joueur a un signe de participation
  // (note présente ou minutes > 0). Évite de compter les remplaçants non entrés.
  const played = allMatches.filter((m) => m.rating != null || (m.minutes ?? 0) > 0);
  const form = played.slice(0, 5);
  const formRatings = form.map((m) => m.rating).filter((r): r is number => r != null);
  const formAvg = formRatings.length
    ? Math.round((formRatings.reduce((a, b) => a + b, 0) / formRatings.length) * 100) / 100
    : null;

  // Mondial = tous les matchs de la compétition Coupe du Monde joués.
  const wcMatches = played.filter((m) => /world cup|coupe du monde|fifa/i.test(rows.find((r) => r.match_id === m.matchId)?.match?.competition ?? ""));
  const wcSource = wcMatches.length ? wcMatches : played; // fallback : tous les matchs trackés
  const wcRatings = wcSource.map((m) => m.rating).filter((r): r is number => r != null);
  const wc: WCAggregate = {
    matches: wcSource.length,
    minutes: wcSource.reduce((a, m) => a + (m.minutes ?? 0), 0),
    goals: wcSource.reduce((a, m) => a + m.goals, 0),
    assists: wcSource.reduce((a, m) => a + m.assists, 0),
    yellowCards: wcSource.reduce((a, m) => a + m.yellowCards, 0),
    redCards: wcSource.reduce((a, m) => a + m.redCards, 0),
    avgRating: wcRatings.length
      ? Math.round((wcRatings.reduce((a, b) => a + b, 0) / wcRatings.length) * 100) / 100
      : null,
  };

  const danger = computeDanger(form);

  const notFound = !bio && !meta && allMatches.length === 0;

  return { id: playerId, bio, meta, form, formAvg, wc, danger, notFound };
}
