// GET /api/wc-team/[slug]/stats
// Cumul par joueur sur la compétition pour une sélection : matchs joués,
// buts, passes, cartons, note moyenne, homme du match. Agrège
// player_match_stats via les matchs où l'équipe figure (côté home/away).
// Vide avant le tournoi (aucun match joué) — l'UI gère la dégradation.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWCTeamBySlug } from "@/lib/football/wc-teams";

interface Agg {
  player_name: string;
  matches: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  motm: number;
  ratingSum: number;
  ratingCount: number;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = getWCTeamBySlug(slug);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const supabase = createAdminClient();

  // Matchs où la sélection joue, avec son côté (team_a = home, team_b = away).
  const { data: matches } = await supabase
    .from("matches")
    .select("id, team_a, team_b")
    .or(`team_a.ilike.${team.name},team_b.ilike.${team.name}`);

  const sideByMatch = new Map<string, "home" | "away">();
  for (const m of matches ?? []) {
    sideByMatch.set(m.id, m.team_a?.toLowerCase() === team.name.toLowerCase() ? "home" : "away");
  }

  if (sideByMatch.size === 0) {
    return NextResponse.json(
      { team: team.name, players: [], played: 0 },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=120" } }
    );
  }

  const { data: rows } = await supabase
    .from("player_match_stats")
    .select("match_id, team_side, player_name, rating, goals, assists, yellow_cards, red_cards, is_motm")
    .in("match_id", [...sideByMatch.keys()]);

  const byPlayer = new Map<string, Agg>();
  const playedMatches = new Set<string>();

  for (const r of rows ?? []) {
    if (sideByMatch.get(r.match_id) !== r.team_side) continue; // l'autre équipe
    playedMatches.add(r.match_id);
    const key = r.player_name;
    let a = byPlayer.get(key);
    if (!a) {
      a = {
        player_name: key, matches: 0, goals: 0, assists: 0,
        yellow_cards: 0, red_cards: 0, motm: 0, ratingSum: 0, ratingCount: 0,
      };
      byPlayer.set(key, a);
    }
    a.matches += 1;
    a.goals += r.goals ?? 0;
    a.assists += r.assists ?? 0;
    a.yellow_cards += r.yellow_cards ?? 0;
    a.red_cards += r.red_cards ?? 0;
    if (r.is_motm) a.motm += 1;
    if (r.rating != null) {
      a.ratingSum += Number(r.rating);
      a.ratingCount += 1;
    }
  }

  const players = [...byPlayer.values()]
    .map((a) => ({
      player_name: a.player_name,
      matches: a.matches,
      goals: a.goals,
      assists: a.assists,
      yellow_cards: a.yellow_cards,
      red_cards: a.red_cards,
      motm: a.motm,
      avg_rating: a.ratingCount ? Math.round((a.ratingSum / a.ratingCount) * 10) / 10 : null,
    }))
    .sort(
      (x, y) =>
        y.goals - x.goals ||
        (y.avg_rating ?? 0) - (x.avg_rating ?? 0) ||
        x.player_name.localeCompare(y.player_name, "fr")
    );

  return NextResponse.json(
    { team: team.name, players, played: playedMatches.size },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=120" } }
  );
}
