// ─────────────────────────────────────────────────────────────────────────────
//  Insights joueurs (SERVEUR) — Phase 2. Zéro nouvelle table, zéro API externe :
//  tout est dérivé de player_match_stats + data/wc-teams.json.
//   • getTopForm        → classement des joueurs les plus en forme
//   • getMatchHotPlayers → joueurs chauds / froids d'un match (Indice Dangerosité)
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/data/select-all";
import { toFrench } from "@/lib/football/team-names";
import { getPlayerMeta, getSquadPlayers, parseMarketValue, isWorldCup, type SquadPlayer } from "@/lib/football/player-card";
import type { RankedPlayer } from "@/lib/football/player-card-types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
// Poids du poste pour la « dangerosité » (un attaquant menace plus qu'un GB).
const POS_WEIGHT: Record<string, number> = { Attaquant: 10, Milieu: 6, Défenseur: 3, Gardien: 1 };

const PHOTO = (id: string) => `https://media.api-sports.io/football/players/${id}.png`;

type StatRow = {
  player_id: string | null;
  player_name: string;
  team_side: "home" | "away";
  rating: number | null;
  goals: number; assists: number; yellow_cards: number; red_cards: number;
  shots: number; dribbles: number;
  minutes: number | null; started: boolean | null;
  key_passes: number | null; duels_won: number | null;
  match: {
    team_a: string; team_b: string; flag_a: string | null; flag_b: string | null;
    score_a: number | null; score_b: number | null; starts_at: string;
    status: string | null; competition: string | null;
  } | null;
};

const COLS =
  "player_id, player_name, team_side, rating, goals, assists, yellow_cards, red_cards, shots, dribbles, minutes, started, key_passes, duels_won, " +
  "match:matches(team_a, team_b, flag_a, flag_b, score_a, score_b, starts_at, status, competition)";

function rankedBase(id: string, name: string): RankedPlayer {
  const meta = getPlayerMeta(id);
  return {
    id, name, photo: PHOTO(id),
    teamName: meta?.teamName ?? null, teamSlug: meta?.teamSlug ?? null, positionFr: meta?.positionFr ?? null,
    avgRating: null, matches: 0, goals: 0, assists: 0,
  };
}

// ─── Top forme ──────────────────────────────────────────────────────────────────
// Classement par note moyenne sur les matchs récents notés (min 2 pour la
// stabilité). worldCupOnly = restreint à la Coupe du Monde quand assez de données.
export async function getTopForm(opts?: { limit?: number; minMatches?: number; worldCupOnly?: boolean }): Promise<RankedPlayer[]> {
  const limit = opts?.limit ?? 20;
  const minMatches = opts?.minMatches ?? 2;
  const supabase = createAdminClient();
  const rows = (await selectAll<StatRow>(supabase, "player_match_stats", COLS)).filter(
    (r) => r.player_id && r.match && r.rating != null && (!opts?.worldCupOnly || isWorldCup(r.match.competition))
  );

  const byId = new Map<string, StatRow[]>();
  for (const r of rows) {
    const id = r.player_id!;
    (byId.get(id) ?? byId.set(id, []).get(id)!).push(r);
  }

  const ranked: RankedPlayer[] = [];
  for (const [id, list] of byId) {
    if (list.length < minMatches) continue;
    const ratings = list.map((r) => r.rating!).filter((x) => x != null);
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const base = rankedBase(id, list[0].player_name);
    ranked.push({
      ...base,
      avgRating: Math.round(avg * 100) / 100,
      matches: list.length,
      goals: list.reduce((a, r) => a + (r.goals ?? 0), 0),
      assists: list.reduce((a, r) => a + (r.assists ?? 0), 0),
    });
  }
  ranked.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.matches - a.matches);
  return ranked.slice(0, limit);
}

// ─── Joueurs à surveiller d'un match ──────────────────────────────────────────
// Indice « à surveiller » PONDÉRÉ (0 appel API, données stockées) :
//   note de forme (WC) · buts tournoi + buts en SÉLECTION (pedigree) · passes
//   décisives · valeur marchande (proxy qualité/saison) · poids du poste.
// On affiche le TOP N de CHAQUE équipe → les deux sélections sont représentées
// (fini le « aucun joueur pour la Belgique »).
const PER_TEAM = 3;

type FormAgg = { ratings: number[]; goals: number; assists: number; starts: number; played: number };

function watchIndex(p: SquadPlayer, f: FormAgg | undefined): RankedPlayer {
  const ratings = f?.ratings ?? [];
  const avgR = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const wcGoals = f?.goals ?? 0, wcAssists = f?.assists ?? 0;
  const startsRatio = f && f.played ? f.starts / f.played : 0;

  const ratingComp = avgR != null ? clamp01((avgR - 5) / 4) * 25 : 8;                 // note WC (ou base)
  const goalsComp = clamp01((wcGoals + (p.selectionGoals ?? 0) * 0.12) / 4) * 22;     // buts tournoi + sélection
  const assistsComp = clamp01(wcAssists / 3) * 12;                                    // passes décisives
  const valueComp = clamp01(parseMarketValue(p.value) / 120_000_000) * 23;            // valeur (proxy saison)
  const posComp = POS_WEIGHT[p.positionFr ?? ""] ?? 4;                                // poste
  const playComp = clamp01(startsRatio) * 8;                                          // temps de jeu
  const watch = Math.round(ratingComp + goalsComp + assistsComp + valueComp + posComp + playComp);

  const meta = getPlayerMeta(p.id);
  return {
    id: p.id, name: p.name, photo: p.photo,
    teamName: meta?.teamName ?? null, teamSlug: meta?.teamSlug ?? null, positionFr: p.positionFr,
    avgRating: avgR != null ? Math.round(avgR * 100) / 100 : null,
    matches: f?.played ?? 0, goals: wcGoals, assists: wcAssists, danger: watch,
  };
}

export async function getMatchHotPlayers(matchId: string): Promise<{ hot: RankedPlayer[]; cold: RankedPlayer[] }> {
  const supabase = createAdminClient();
  const { data: match } = await supabase.from("matches").select("team_a, team_b").eq("id", matchId).single();
  if (!match) return { hot: [], cold: [] };

  const squadA = getSquadPlayers(toFrench(match.team_a));
  const squadB = getSquadPlayers(toFrench(match.team_b));
  const all = [...squadA, ...squadB];
  if (!all.length) return { hot: [], cold: [] };

  // Forme WC trackée (notes/buts/passes/titularisations) pour ces joueurs.
  const { data } = await supabase
    .from("player_match_stats")
    .select("player_id, rating, goals, assists, started, minutes, match:matches(competition)")
    .in("player_id", all.map((p) => p.id));
  const form = new Map<string, FormAgg>();
  for (const r of (data ?? []) as unknown as { player_id: string | null; rating: number | null; goals: number | null; assists: number | null; started: boolean | null; minutes: number | null; match: { competition: string | null } | null }[]) {
    if (!r.player_id) continue;
    if (!isWorldCup(r.match?.competition)) continue; // exclut les matchs test / hors-CdM
    const f = form.get(r.player_id) ?? { ratings: [], goals: 0, assists: 0, starts: 0, played: 0 };
    if (r.rating != null) f.ratings.push(r.rating);
    f.goals += r.goals ?? 0; f.assists += r.assists ?? 0;
    if (r.started) f.starts++;
    if ((r.minutes ?? 0) > 0 || r.rating != null) f.played++;
    form.set(r.player_id, f);
  }

  const topOf = (squad: SquadPlayer[]) =>
    squad.map((p) => watchIndex(p, form.get(p.id))).sort((a, b) => (b.danger ?? 0) - (a.danger ?? 0)).slice(0, PER_TEAM);

  const hot = [...topOf(squadA), ...topOf(squadB)].sort((a, b) => (b.danger ?? 0) - (a.danger ?? 0));
  return { hot, cold: [] };
}
