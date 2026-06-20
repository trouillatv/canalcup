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
import { computeDanger, getPlayerMeta, getSquadPlayerIds, isWorldCup } from "@/lib/football/player-card";
import type { PlayerFormMatch, RankedPlayer } from "@/lib/football/player-card-types";

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

function toForm(r: StatRow): PlayerFormMatch {
  const m = r.match!;
  return {
    matchId: "", date: m.starts_at,
    teamA: toFrench(m.team_a), teamB: toFrench(m.team_b),
    flagA: m.flag_a, flagB: m.flag_b, scoreA: m.score_a, scoreB: m.score_b, status: m.status,
    isHome: r.team_side === "home",
    rating: r.rating, goals: r.goals ?? 0, assists: r.assists ?? 0,
    yellowCards: r.yellow_cards ?? 0, redCards: r.red_cards ?? 0,
    minutes: r.minutes ?? null, started: r.started ?? null,
    shots: r.shots ?? 0, keyPasses: r.key_passes ?? null, duelsWon: r.duels_won ?? null,
    dribbles: r.dribbles ?? 0,
  };
}

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

// ─── Chauds / froids d'un match ───────────────────────────────────────────────
export async function getMatchHotPlayers(matchId: string): Promise<{ hot: RankedPlayer[]; cold: RankedPlayer[] }> {
  const supabase = createAdminClient();
  const { data: match } = await supabase.from("matches").select("team_a, team_b").eq("id", matchId).single();
  if (!match) return { hot: [], cold: [] };

  const ids = [...getSquadPlayerIds(match.team_a), ...getSquadPlayerIds(match.team_b)];
  if (!ids.length) return { hot: [], cold: [] };

  const { data } = await supabase.from("player_match_stats").select(COLS).in("player_id", ids);
  const rows = ((data ?? []) as unknown as StatRow[]).filter((r) => r.player_id && r.match);

  const byId = new Map<string, StatRow[]>();
  for (const r of rows) {
    const id = r.player_id!;
    (byId.get(id) ?? byId.set(id, []).get(id)!).push(r);
  }

  const scored: (RankedPlayer & { danger: number; lastPlayed: boolean })[] = [];
  for (const [id, list] of byId) {
    list.sort((a, b) => new Date(b.match!.starts_at).getTime() - new Date(a.match!.starts_at).getTime());
    const forms = list.map(toForm).filter((f) => f.rating != null || (f.minutes ?? 0) > 0).slice(0, 5);
    if (!forms.length) continue;
    const d = computeDanger(forms);
    if (!d) continue;
    const ratings = forms.map((f) => f.rating).filter((r): r is number => r != null);
    scored.push({
      ...rankedBase(id, list[0].player_name),
      avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null,
      matches: forms.length,
      goals: forms.reduce((a, f) => a + f.goals, 0),
      assists: forms.reduce((a, f) => a + f.assists, 0),
      danger: d.score,
      lastPlayed: (forms[0].minutes ?? 0) > 0 || forms[0].rating != null,
    });
  }

  const hot = scored.filter((p) => p.danger >= 55).sort((a, b) => b.danger - a.danger).slice(0, 5);
  // Froids = joueurs qui ont récemment joué mais avec un Indice faible (contraste).
  const cold = scored.filter((p) => p.lastPlayed && p.danger < 45).sort((a, b) => a.danger - b.danger).slice(0, 3);

  return { hot, cold };
}
