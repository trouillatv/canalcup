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
import { getWCTeamByName } from "@/lib/football/wc-teams";
import type {
  PlayerMeta, PlayerBio, PlayerFormMatch, WCAggregate, DangerIndex, PlayerCard, RelatedPlayer,
  SeasonStats, SeasonCompetition,
} from "@/lib/football/player-card-types";

export type { PlayerMeta, PlayerBio, PlayerFormMatch, WCAggregate, DangerIndex, PlayerCard, RelatedPlayer, SeasonStats };

const APIF = "https://v3.football.api-sports.io";
// Saison club courante (numérotation API-Football : 2025 = saison 2025-26).
const CLUB_SEASON = 2025;
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
const RAW_BY_ID = new Map<string, { team: RawWCTeam; player: RawWCPlayer }>();
const TEAM_BY_SLUG = new Map<string, RawWCTeam>();
for (const t of rawData as RawWCTeam[]) {
  TEAM_BY_SLUG.set(t.slug, t);
  for (const p of t.players ?? []) {
    if (p.api_football_id == null) continue;
    const id = String(p.api_football_id);
    RAW_BY_ID.set(id, { team: t, player: p });
    META_BY_ID.set(id, {
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

const photoFor = (id: string, photo?: string | null) =>
  photo ?? `https://media.api-sports.io/football/players/${id}.png`;

export function getPlayerMeta(id: string): PlayerMeta | null {
  return META_BY_ID.get(id) ?? null;
}

// Coéquipiers de sélection (curiosité / navigation). Variété de postes d'abord.
function getTeammates(id: string, limit = 6): RelatedPlayer[] {
  const entry = RAW_BY_ID.get(id);
  if (!entry) return [];
  const mates = entry.team.players.filter((p) => p.api_football_id != null && String(p.api_football_id) !== id);
  // Tri : on disperse les postes (G/D/M/A) pour montrer un échantillon varié.
  const order: Record<string, number> = { Gardien: 0, Défenseur: 1, Milieu: 2, Attaquant: 3 };
  mates.sort((a, b) => (order[a.position ?? ""] ?? 9) - (order[b.position ?? ""] ?? 9));
  return mates.slice(0, limit).map((p) => ({
    id: String(p.api_football_id),
    name: p.name,
    photo: photoFor(String(p.api_football_id), p.photo),
    positionFr: p.position ?? null,
  }));
}

// Liste des api_football_id d'une sélection (résolution par nom, alias inclus).
export function getSquadPlayerIds(teamName: string): string[] {
  const t = getWCTeamByName(teamName);
  const raw = t ? TEAM_BY_SLUG.get(t.slug) : null;
  if (!raw) return [];
  return raw.players.filter((p) => p.api_football_id != null).map((p) => String(p.api_football_id));
}

// Recherche de joueurs (comparateur) — sur wc-teams.json, sans DB ni API.
export function searchPlayers(q: string, limit = 12): { id: string; name: string; photo: string; teamName: string }[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const needle = norm(q.trim());
  if (needle.length < 2) return [];
  const out: { id: string; name: string; photo: string; teamName: string }[] = [];
  for (const { team, player } of RAW_BY_ID.values()) {
    if (norm(player.name).includes(needle)) {
      out.push({ id: String(player.api_football_id), name: player.name, photo: photoFor(String(player.api_football_id), player.photo), teamName: team.name });
      if (out.length >= limit * 3) break;
    }
  }
  // Priorité aux noms qui COMMENCENT par la recherche.
  out.sort((a, b) => Number(norm(b.name).startsWith(needle)) - Number(norm(a.name).startsWith(needle)));
  return out.slice(0, limit);
}

// "€120m" / "€700k" / "€1.2m" → nombre (pour comparer les valeurs marchandes).
function parseValue(v: string | null): number {
  if (!v) return 0;
  const m = v.replace(/[, ]/g, "").match(/([\d.]+)\s*([mk])?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  return unit === "m" ? n * 1e6 : unit === "k" ? n * 1e3 : n;
}

export function isWorldCup(competition: string | null | undefined): boolean {
  return /world cup|coupe du monde|fifa/i.test(competition ?? "");
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

// ─── API : stats saison par compétition (/players?id=&season=) ───────────────────
async function fetchSeason(playerId: string): Promise<SeasonStats | null> {
  if (!hasApiFootball()) return null;
  try {
    const res = await fetch(`${APIF}/players?id=${playerId}&season=${CLUB_SEASON}`, {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY! },
      // Stats saison quasi stables : cache 12 h.
      next: { revalidate: 43200 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats: any[] = json?.response?.[0]?.statistics ?? [];
    if (!stats.length) return null;
    const competitions: SeasonCompetition[] = stats.map((s) => {
      const r = s.games?.rating;
      return {
        league: s.league?.name ?? "—",
        country: s.league?.country ?? null,
        team: s.team?.name ?? null,
        appearances: s.games?.appearences ?? 0,
        lineups: s.games?.lineups ?? 0,
        minutes: s.games?.minutes ?? 0,
        goals: s.goals?.total ?? 0,
        assists: s.goals?.assists ?? 0,
        yellowCards: s.cards?.yellow ?? 0,
        redCards: s.cards?.red ?? 0,
        rating: r != null && r !== "" ? Math.round(parseFloat(r) * 100) / 100 : null,
      };
    });
    // Totaux : note moyenne pondérée par les matchs joués.
    const totalApps = competitions.reduce((a, c) => a + c.appearances, 0);
    const ratedApps = competitions.filter((c) => c.rating != null).reduce((a, c) => a + c.appearances, 0);
    const weightedRating = ratedApps
      ? competitions.filter((c) => c.rating != null).reduce((a, c) => a + c.rating! * c.appearances, 0) / ratedApps
      : null;
    return {
      label: `${CLUB_SEASON}-${String(CLUB_SEASON + 1).slice(2)}`,
      competitions: competitions.sort((a, b) => b.appearances - a.appearances),
      totals: {
        appearances: totalApps,
        goals: competitions.reduce((a, c) => a + c.goals, 0),
        assists: competitions.reduce((a, c) => a + c.assists, 0),
        minutes: competitions.reduce((a, c) => a + c.minutes, 0),
        rating: weightedRating != null ? Math.round(weightedRating * 100) / 100 : null,
      },
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

export function computeDanger(played: PlayerFormMatch[]): DangerIndex | null {
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

// ─── « Le saviez-vous » — faits dérivés de NOS données (zéro source externe) ──
function buildFacts(playerId: string, meta: PlayerMeta | null, age: number | null, formAvg: number | null): string[] {
  const facts: string[] = [];
  const entry = RAW_BY_ID.get(playerId);
  const team = meta?.teamName ?? "sa sélection";

  if (meta?.selectionGoals != null && meta.caps != null && meta.caps > 0) {
    facts.push(`⚽ ${meta.selectionGoals} but${meta.selectionGoals > 1 ? "s" : ""} en ${meta.caps} sélection${meta.caps > 1 ? "s" : ""} avec ${team}.`);
  } else if (meta?.caps != null && meta.caps > 0) {
    facts.push(`🎽 ${meta.caps} sélection${meta.caps > 1 ? "s" : ""} avec ${team}.`);
  }

  // Contexte effectif : joueur le plus cher / benjamin / doyen de la sélection.
  if (entry) {
    const squad = entry.team.players;
    const myVal = parseValue(meta?.value ?? null);
    if (myVal > 0) {
      const maxVal = Math.max(...squad.map((p) => parseValue(p.value ?? null)));
      if (myVal >= maxVal && maxVal > 0) facts.push(`💰 Joueur le plus cher de ${team} (${meta?.value}).`);
      else if (meta?.value) facts.push(`💰 Valeur estimée : ${meta.value}.`);
    }
    if (age != null) {
      const ages = squad.map((p) => p.age).filter((a): a is number => a != null);
      if (ages.length >= 5) {
        if (age <= Math.min(...ages)) facts.push(`🐣 Benjamin de ${team} (${age} ans).`);
        else if (age >= Math.max(...ages)) facts.push(`🧓 Doyen de ${team} (${age} ans).`);
      }
    }
  }

  if (formAvg != null && formAvg >= 7.5) {
    facts.push(`🔥 En feu : ${formAvg.toFixed(1)} de moyenne sur ses derniers matchs.`);
  }

  return facts.slice(0, 3);
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

  const [bio, season, statsRes] = await Promise.all([
    fetchBio(playerId),
    fetchSeason(playerId),
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
  const wcMatches = played.filter((m) => isWorldCup(rows.find((r) => r.match_id === m.matchId)?.match?.competition));
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
  const related = getTeammates(playerId);
  const facts = buildFacts(playerId, meta, bio?.age ?? RAW_BY_ID.get(playerId)?.player.age ?? null, formAvg);

  const notFound = !bio && !meta && allMatches.length === 0;

  return { id: playerId, bio, meta, form, formAvg, wc, season, danger, related, facts, notFound };
}
