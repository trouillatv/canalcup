// GET /api/tournament/stats
// Agrège player_match_stats sur tout le tournoi :
//   - classement joueurs (note, buts, passes, cartons, motm)
//   - classement équipes (note moyenne de leurs joueurs)
//   - 11 type (meilleurs joueurs par poste : GK/DEF/MID/FWD)
// Cache 5 min côté CDN — zéro donnée avant le premier match joué.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/data/select-all";

// Normalise les postes bruts vers 4 buckets stables.
function positionBucket(raw: string | null | undefined): "GK" | "DEF" | "MID" | "FWD" | null {
  if (!raw) return null;
  const r = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (r.includes("gardien") || r.includes("goalkeeper") || r.includes("keeper") || r === "gk") return "GK";
  if (r.includes("defenseur") || r.includes("defender") || r.includes("back") || r.includes("arriere") || r === "cb" || r === "lb" || r === "rb") return "DEF";
  if (r.includes("milieu") || r.includes("midfielder") || r.includes("midfield") || r === "cm" || r === "dm" || r === "am") return "MID";
  if (r.includes("avant") || r.includes("ailier") || r.includes("attaquant") || r.includes("forward") || r.includes("striker") || r.includes("winger") || r === "st" || r === "cf" || r === "lw" || r === "rw") return "FWD";
  return null;
}

function normName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function shortNameKey(raw: string): string {
  const parts = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (parts.length < 2) return normName(raw);
  return `${parts[0][0]}${parts[parts.length - 1]}`;
}

export async function GET() {
  const supabase = createAdminClient();

  // Récupère stats joueurs + lineups + matchs en parallèle.
  const { data: matchesRaw } = await supabase
    .from("matches")
    .select("id, team_a, team_b, phase, stage, status")
    .eq("status", "finished");

  const matches = (matchesRaw ?? []).filter((m) =>
    m.phase === "Groupe" ? Boolean(m.stage) : m.phase !== "Groupe"
  );
  const matchIds = matches.map((m) => m.id);

  if (matchIds.length === 0) {
    return NextResponse.json(
      { players: [], teams: [], best_xi: { gk: [], def: [], mid: [], fwd: [] }, total_matches: 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // selectAll : pagination OBLIGATOIRE — player_match_stats dépasse 1000 lignes
  // (≈36/match), donc un .in() simple tronquait SILENCIEUSEMENT à 1000 → stats,
  // positions (11 type / filtre par poste) et buteurs sous-comptés.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inMatches = (q: any) => q.in("match_id", matchIds);
  const [statsAll, lineupsAll, eventsAll] = await Promise.all([
    selectAll<{ match_id: string; team_side: string; player_name: string; player_id: string | number | null; rating: number | null; goals: number | null; assists: number | null; yellow_cards: number | null; red_cards: number | null; is_motm: boolean | null }>(
      supabase, "player_match_stats", "match_id, team_side, player_name, player_id, rating, goals, assists, yellow_cards, red_cards, is_motm", inMatches),
    selectAll<{ match_id: string; team_side: string; player_name: string; position: string | null; is_starting: boolean | null }>(
      supabase, "match_lineups", "match_id, team_side, player_name, position, is_starting", inMatches),
    selectAll<{ match_id: string; team_side: string; player_name: string | null; assist_player_name: string | null; type: string }>(
      supabase, "match_events", "match_id, team_side, player_name, assist_player_name, type", inMatches),
  ]);

  const stats = statsAll.filter((r) => r.rating != null);
  const lineups = lineupsAll;
  const events = eventsAll;

  if (stats.length === 0) {
    return NextResponse.json(
      { players: [], teams: [], best_xi: { gk: [], def: [], mid: [], fwd: [] }, total_matches: 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Résout matchId → { teamHome, teamAway }
  const matchTeams = new Map<string, { home: string; away: string }>();
  for (const m of matches) {
    matchTeams.set(m.id, { home: m.team_a ?? "", away: m.team_b ?? "" });
  }

  // Position la plus fréquente par (player_name, team_side, match_id)
  const positionFreq = new Map<string, Map<string, number>>();
  for (const l of lineups) {
    const bucket = positionBucket(l.position);
    if (!bucket) continue;
    const key = `${l.player_name}|||${l.team_side}|||${l.match_id}`;
    if (!positionFreq.has(key)) positionFreq.set(key, new Map());
    positionFreq.get(key)!.set(bucket, (positionFreq.get(key)!.get(bucket) ?? 0) + 1);
  }

  // Position globale par joueur (poste le plus fréquent sur le tournoi)
  const playerPosition = new Map<string, Map<string, number>>();
  for (const [key, freq] of positionFreq.entries()) {
    const [playerName] = key.split("|||");
    if (!playerPosition.has(playerName)) playerPosition.set(playerName, new Map());
    for (const [bucket, count] of freq.entries()) {
      playerPosition.get(playerName)!.set(bucket, (playerPosition.get(playerName)!.get(bucket) ?? 0) + count);
    }
  }

  function dominantPosition(name: string): "GK" | "DEF" | "MID" | "FWD" | null {
    const freq = playerPosition.get(name);
    if (!freq || freq.size === 0) return null;
    let best: string | null = null; let bestCount = 0;
    for (const [bucket, count] of freq.entries()) {
      if (count > bestCount) { bestCount = count; best = bucket; }
    }
    return best as "GK" | "DEF" | "MID" | "FWD" | null;
  }

  // Agrégation par joueur
  type Agg = {
    player_name: string; team: string; player_id: string | null;
    matches: number; goals: number; assists: number;
    yellow_cards: number; red_cards: number; motm: number;
    ratingSum: number; ratingCount: number;
  };

  const byPlayer = new Map<string, Agg>();
  const playerKeyIndex = new Map<string, string>();
  const teamGoals = new Map<string, number>();
  const teamRating = new Map<string, { sum: number; count: number }>();

  for (const r of stats) {
    const teamMap = matchTeams.get(r.match_id);
    const teamName = teamMap
      ? (r.team_side === "home" ? teamMap.home : teamMap.away)
      : "";

    const key = `${r.player_name}|||${teamName}`;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, {
        player_name: r.player_name, team: teamName, player_id: null,
        matches: 0, goals: 0, assists: 0,
        yellow_cards: 0, red_cards: 0, motm: 0,
        ratingSum: 0, ratingCount: 0,
      });
      playerKeyIndex.set(`${teamName}|||${normName(r.player_name)}`, key);
      playerKeyIndex.set(`${teamName}|||${shortNameKey(r.player_name)}`, key);
    }
    const a = byPlayer.get(key)!;
    if (!a.player_id && r.player_id) a.player_id = String(r.player_id);
    a.matches += 1;
    // ⚠️ Buts/passes : PAS depuis player_match_stats (peu fiable — ex. Messi y a
    // 1 but au lieu de 5). On les compte exclusivement depuis match_events.
    a.yellow_cards += r.yellow_cards ?? 0;
    a.red_cards += r.red_cards ?? 0;
    if (r.is_motm) a.motm += 1;
    if (r.rating != null) { a.ratingSum += Number(r.rating); a.ratingCount += 1; }

    // note moyenne d'équipe (les buts d'équipe sont comptés via match_events)
    if (teamName && r.rating != null) {
      const tr = teamRating.get(teamName) ?? { sum: 0, count: 0 };
      tr.sum += Number(r.rating); tr.count += 1;
      teamRating.set(teamName, tr);
    }
  }

  for (const e of events) {
    const teamMap = matchTeams.get(e.match_id);
    if (!teamMap) continue;
    const teamName = e.team_side === "home" ? teamMap.home : teamMap.away;
    const ensurePlayer = (playerName: string) => {
      const key =
        playerKeyIndex.get(`${teamName}|||${normName(playerName)}`) ??
        playerKeyIndex.get(`${teamName}|||${shortNameKey(playerName)}`) ??
        `${playerName}|||${teamName}`;
      if (!byPlayer.has(key)) {
        byPlayer.set(key, {
          player_name: playerName, team: teamName, player_id: null,
          matches: 0, goals: 0, assists: 0,
          yellow_cards: 0, red_cards: 0, motm: 0,
          ratingSum: 0, ratingCount: 0,
        });
        playerKeyIndex.set(`${teamName}|||${normName(playerName)}`, key);
        playerKeyIndex.set(`${teamName}|||${shortNameKey(playerName)}`, key);
      }
      return byPlayer.get(key)!;
    };

    if (e.type === "goal" && e.player_name) {
      ensurePlayer(e.player_name).goals += 1;
      if (teamName) teamGoals.set(teamName, (teamGoals.get(teamName) ?? 0) + 1);
    }
    if (e.type === "goal" && e.assist_player_name) {
      ensurePlayer(e.assist_player_name).assists += 1;
    }
  }

  const players = [...byPlayer.values()]
    .map((a) => ({
      player_name: a.player_name,
      player_id: a.player_id,
      team: a.team,
      matches: a.matches,
      avg_rating: a.ratingCount ? Math.round((a.ratingSum / a.ratingCount) * 10) / 10 : null,
      goals: a.goals,
      assists: a.assists,
      yellow_cards: a.yellow_cards,
      red_cards: a.red_cards,
      motm: a.motm,
      position: dominantPosition(a.player_name),
    }))
    .sort((x, y) =>
      (y.avg_rating ?? 0) - (x.avg_rating ?? 0) ||
      y.goals - x.goals ||
      x.player_name.localeCompare(y.player_name, "fr")
    );

  // Classement équipes
  const teams = [...teamRating.entries()]
    .map(([team, { sum, count }]) => ({
      team,
      avg_rating: count ? Math.round((sum / count) * 10) / 10 : null,
      goals: teamGoals.get(team) ?? 0,
      player_count: count,
    }))
    .sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));

  // 11 type — meilleurs par poste (4-3-3)
  const byPos = { GK: [] as typeof players, DEF: [] as typeof players, MID: [] as typeof players, FWD: [] as typeof players };
  for (const p of players) {
    if (p.position && byPos[p.position]) byPos[p.position].push(p);
  }

  const best_xi = {
    gk:  byPos.GK.slice(0, 1),
    def: byPos.DEF.slice(0, 4),
    mid: byPos.MID.slice(0, 3),
    fwd: byPos.FWD.slice(0, 3),
  };

  return NextResponse.json(
    { players, teams, best_xi, total_matches: matches.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}
