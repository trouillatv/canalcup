// Notes joueurs ESTIMÉES — fallback quand API-Football Pro indisponible.
// Source = "gemini" (toujours labellisé « estimé » côté UI, jamais WhoScored).
// Si pas de clé Gemini / MOCK_AI : heuristique déterministe à partir des
// événements (le MVP reste fonctionnel sans dépendance externe).
//
// Ne PERSISTE rien : retourne des PlayerMatchStat[] que sync.ts upsert.

import { callGemini } from "@/services/ai/gemini";
import { PROMPTS } from "@/services/ai/prompts";
import { recordCost } from "@/services/ai/cost-tracker";
import type { MatchEvent, LineupPlayer, PlayerMatchStat, TeamSide } from "@/services/football/types";

interface RatingContext {
  matchId: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  phase: string;
  events: MatchEvent[];
  homeLineup: LineupPlayer[];
  awayLineup: LineupPlayer[];
}

const clamp = (n: number) => Math.max(4, Math.min(9.5, Math.round(n * 10) / 10));

function blank(side: TeamSide, name: string, matchId: string): PlayerMatchStat {
  return {
    match_id: matchId, team_side: side, player_name: name, rating: null,
    goals: 0, assists: 0, yellow_cards: 0, red_cards: 0,
    shots: 0, passes: 0, tackles: 0, dribbles: 0, is_motm: false, source: "gemini",
  };
}

// Agrège les événements par joueur (titulaires uniquement).
function tally(ctx: RatingContext): Map<string, PlayerMatchStat> {
  const map = new Map<string, PlayerMatchStat>();
  const add = (side: TeamSide, p: LineupPlayer) => {
    if (p.is_starting) map.set(`${side}:${p.player_name}`, blank(side, p.player_name, ctx.matchId));
  };
  ctx.homeLineup.forEach((p) => add("home", p));
  ctx.awayLineup.forEach((p) => add("away", p));

  for (const e of ctx.events) {
    const key = `${e.team_side}:${e.player_name}`;
    const s = map.get(key);
    if (!s) continue;
    if (e.type === "goal") s.goals += 1;
    if (e.type === "yellow_card") s.yellow_cards += 1;
    if (e.type === "red_card") s.red_cards += 1;
    if (e.assist_player_name) {
      const a = map.get(`${e.team_side}:${e.assist_player_name}`);
      if (a) a.assists += 1;
    }
  }
  return map;
}

function heuristic(ctx: RatingContext): PlayerMatchStat[] {
  const map = tally(ctx);
  const homeWon = ctx.scoreA > ctx.scoreB;
  const awayWon = ctx.scoreB > ctx.scoreA;
  for (const s of map.values()) {
    const teamDelta = (s.team_side === "home" && homeWon) || (s.team_side === "away" && awayWon)
      ? 0.3 : (ctx.scoreA === ctx.scoreB ? 0 : -0.3);
    s.rating = clamp(
      6 + s.goals * 1.2 + s.assists * 0.7 - s.yellow_cards * 0.3 - s.red_cards * 1.5 + teamDelta
    );
  }
  const list = [...map.values()];
  const best = list.reduce<PlayerMatchStat | null>(
    (acc, p) => (p.rating != null && (!acc || (acc.rating ?? 0) < p.rating) ? p : acc), null
  );
  if (best) best.is_motm = true;
  return list;
}

function eventSummary(ctx: RatingContext): string {
  const teamLabel = (s: TeamSide) => (s === "home" ? ctx.teamA : ctx.teamB);
  return ctx.events
    .filter((e) => ["goal", "yellow_card", "red_card", "substitution"].includes(e.type))
    .map((e) => {
      const m = `${e.minute}'`;
      if (e.type === "goal")
        return `${m} but ${e.player_name} (${teamLabel(e.team_side)})${e.assist_player_name ? ` p.d. ${e.assist_player_name}` : ""}`;
      if (e.type === "yellow_card") return `${m} jaune ${e.player_name}`;
      if (e.type === "red_card") return `${m} rouge ${e.player_name}`;
      return `${m} chgt ${e.player_name}`;
    })
    .join(" · ");
}

/** Notes estimées pour un match fini. Toujours source "gemini" (= estimé). */
export async function generatePlayerRatings(ctx: RatingContext): Promise<PlayerMatchStat[]> {
  const useGemini = process.env.MOCK_AI !== "true" && !!process.env.GEMINI_API_KEY;
  if (!useGemini) return heuristic(ctx);

  try {
    const prompt = PROMPTS.playerRatings({
      teamA: ctx.teamA, teamB: ctx.teamB, scoreA: ctx.scoreA, scoreB: ctx.scoreB,
      phase: ctx.phase,
      homeStarters: ctx.homeLineup.filter((p) => p.is_starting).map((p) => p.player_name),
      awayStarters: ctx.awayLineup.filter((p) => p.is_starting).map((p) => p.player_name),
      events: eventSummary(ctx),
    });
    const res = await callGemini<{
      players: {
        team_side: TeamSide; player_name: string; rating: number;
        goals?: number; assists?: number; yellow_cards?: number; red_cards?: number; is_motm?: boolean;
      }[];
    }>(prompt);
    recordCost("player_ratings", res.tokens, res.estimatedCostEur);

    const rows = (res.data?.players ?? [])
      .filter((p) => p.player_name && (p.team_side === "home" || p.team_side === "away"))
      .map<PlayerMatchStat>((p) => ({
        ...blank(p.team_side, p.player_name, ctx.matchId),
        rating: p.rating != null ? clamp(p.rating) : null,
        goals: p.goals ?? 0, assists: p.assists ?? 0,
        yellow_cards: p.yellow_cards ?? 0, red_cards: p.red_cards ?? 0,
        is_motm: !!p.is_motm,
      }));

    if (!rows.length) return heuristic(ctx);
    if (!rows.some((r) => r.is_motm)) {
      const best = rows.reduce((a, b) => ((b.rating ?? 0) > (a.rating ?? 0) ? b : a));
      best.is_motm = true;
    }
    return rows;
  } catch (err) {
    console.warn("[player-ratings] Gemini KO, fallback heuristique:", err);
    return heuristic(ctx);
  }
}
