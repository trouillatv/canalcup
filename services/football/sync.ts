// Sync service — writes football data from provider into Supabase
// Called by cron + triggered on-demand when cache misses

import { createAdminClient } from "@/lib/supabase/admin";
import { cache, matchTTL, TTL } from "./cache";
import { tsdbTimeline, tsdbStatus } from "./transformers";
import { toFrench, toFlag } from "@/lib/football/team-names";
import type { FullMatchDetail, MatchEvent, LineupPlayer, MatchStat } from "./types";

const TSDB = "https://www.thesportsdb.com/api/v1/json/3";

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function tsdbFetch(path: string) {
  const res = await fetch(`${TSDB}${path}`, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  return res.json();
}

// ─── Event sync ───────────────────────────────────────────────────────────────

async function syncEvents(matchId: string, externalId: number, homeExtId: string): Promise<MatchEvent[]> {
  const supabase = createAdminClient();
  const json = await tsdbFetch(`/lookuptimeline.php?id=${externalId}`);
  const events = tsdbTimeline(json?.timeline ?? [], matchId, homeExtId);

  if (events.length > 0) {
    await supabase.from("match_events").delete().eq("match_id", matchId);
    await supabase.from("match_events").insert(events);
  }
  return events;
}

// ─── Lineup sync ─────────────────────────────────────────────────────────────

async function syncLineups(matchId: string, externalId: number): Promise<LineupPlayer[] | null> {
  const supabase = createAdminClient();
  const json = await tsdbFetch(`/lookuplineups.php?id=${externalId}`);
  const players = json?.lineup ?? [];
  if (!players.length) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineupRows: LineupPlayer[] = players.map((p: any) => ({
    match_id: matchId,
    team_side: p.strSide === "home" ? "home" : "away",
    player_name: p.strPlayer ?? "",
    shirt_number: parseInt(p.intSquadNumber ?? "0", 10),
    position: p.strPosition ?? "",
    is_starting: (p.strSubstitute ?? "").toLowerCase() !== "true",
  }));

  await supabase.from("match_lineups").delete().eq("match_id", matchId);
  await supabase.from("match_lineups").insert(lineupRows);
  return lineupRows;
}

// ─── Stats — TheSportsDB free doesn't have stats, placeholder ────────────────

async function loadStatsFromDB(matchId: string): Promise<MatchStat[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("match_stats")
    .select("*")
    .eq("match_id", matchId);
  return (data ?? []) as MatchStat[];
}

// ─── Full match detail ────────────────────────────────────────────────────────

export async function getMatchDetail(matchId: string): Promise<FullMatchDetail | null> {
  const cacheKey = `match:${matchId}`;

  // Check memory cache first
  const cached = cache.get<FullMatchDetail>(cacheKey);
  if (cached) return cached;

  const supabase = createAdminClient();

  // Load match from DB
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (!match) return null;

  const externalId = match.external_id;
  const status = match.status ?? "upcoming";

  // Load events from DB (or sync if live/no data)
  let events: MatchEvent[] = [];
  const { data: dbEvents } = await supabase
    .from("match_events")
    .select("*")
    .eq("match_id", matchId)
    .order("minute", { ascending: true });

  if (dbEvents?.length) {
    events = dbEvents as MatchEvent[];
  } else if (externalId && (status === "live" || status === "halftime" || status === "finished")) {
    events = await syncEvents(matchId, externalId, "");
  }

  // Load lineups from DB (or sync)
  const { data: dbLineups } = await supabase
    .from("match_lineups")
    .select("*")
    .eq("match_id", matchId);

  let lineups: FullMatchDetail["lineups"] = null;
  if (dbLineups?.length) {
    const home = dbLineups.filter((p) => p.team_side === "home") as LineupPlayer[];
    const away = dbLineups.filter((p) => p.team_side === "away") as LineupPlayer[];
    lineups = { home, away };
  } else if (externalId && (status === "finished" || status === "live")) {
    const players = await syncLineups(matchId, externalId);
    if (players) {
      lineups = {
        home: players.filter((p) => p.team_side === "home"),
        away: players.filter((p) => p.team_side === "away"),
      };
    }
  }

  // Load stats
  const stats = await loadStatsFromDB(matchId);

  // Load standings for group matches
  let standings;
  if (match.phase === "Groupe" || match.phase === "Group Stage") {
    const { data: rows } = await supabase.from("standings").select("*").order("points", { ascending: false });
    standings = rows ?? undefined;
  }

  const detail: FullMatchDetail = {
    match: {
      id: match.id,
      external_id: match.external_id,
      competition: match.competition,
      phase: match.phase,
      stage: match.stage,
      team_a: match.team_a,
      team_b: match.team_b,
      flag_a: match.flag_a,
      flag_b: match.flag_b,
      score_a: match.score_a,
      score_b: match.score_b,
      status: match.status,
      minute: match.minute,
      starts_at: match.starts_at,
      venue: match.venue,
      referee: match.referee,
      channel: match.channel,
      is_featured: match.is_featured ?? false,
    },
    events,
    lineups,
    stats,
    standings,
  };

  cache.set(cacheKey, detail, matchTTL(status));
  return detail;
}

// ─── Live match score sync ────────────────────────────────────────────────────

export async function syncLiveScores(): Promise<number> {
  const supabase = createAdminClient();

  const { data: liveMatches } = await supabase
    .from("matches")
    .select("id, external_id, status, team_a, team_b")
    .in("status", ["live", "halftime"]);

  if (!liveMatches?.length) return 0;

  let synced = 0;
  for (const m of liveMatches) {
    if (!m.external_id) continue;
    const json = await tsdbFetch(`/lookupevent.php?id=${m.external_id}`);
    const e = json?.events?.[0];
    if (!e) continue;

    const status = tsdbStatus(e);
    const minute = e.intProgress ? parseInt(e.intProgress, 10) : null;
    const scoreA = e.intHomeScore !== null && e.intHomeScore !== "" ? parseInt(e.intHomeScore, 10) : null;
    const scoreB = e.intAwayScore !== null && e.intAwayScore !== "" ? parseInt(e.intAwayScore, 10) : null;

    await supabase.from("matches").update({
      status,
      minute,
      score_a: scoreA,
      score_b: scoreB,
      venue: e.strVenue ?? undefined,
      referee: e.strOfficial ?? undefined,
      updated_at: new Date().toISOString(),
    }).eq("id", m.id);

    // Sync events for live match
    if (m.external_id) {
      await syncEvents(m.id, m.external_id, e.idHomeTeam ?? "");
    }

    cache.invalidate(`match:${m.id}`);
    synced++;
  }
  return synced;
}

// ─── Phase normalization ──────────────────────────────────────────────────────

function normalizePhase(strRound?: string): { phase: string; stage: string | null } {
  if (!strRound) return { phase: "Groupe", stage: null };
  const r = strRound.toLowerCase();
  if (/^group [a-l]$/i.test(strRound) || r.includes("group stage") || r.includes("group")) {
    return { phase: "Groupe", stage: strRound };
  }
  if (r.includes("round of 16") || r.includes("16")) return { phase: "Huitièmes", stage: null };
  if (r.includes("quarter")) return { phase: "Quarts", stage: null };
  if (r.includes("semi")) return { phase: "Demis", stage: null };
  if (r.includes("3rd") || r.includes("third place") || r.includes("third-place")) return { phase: "3ème place", stage: null };
  if (r.includes("final")) return { phase: "Finale", stage: null };
  return { phase: "Groupe", stage: strRound };
}

// ─── Standings sync ───────────────────────────────────────────────────────────

export async function syncStandings(): Promise<number> {
  const supabase = createAdminClient();
  const json = await tsdbFetch(`/lookuptable.php?l=4429&s=2026`);
  const rows = json?.table ?? [];
  if (!rows.length) return 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upsertRows = rows.map((r: any) => ({
    competition: "FIFA World Cup 2026",
    group_name: r.strGroupName ?? "Group A",
    team_name: r.strTeam ?? "",
    team_name_fr: toFrench(r.strTeam ?? ""),
    team_flag: toFlag(r.strTeam ?? ""),
    rank: parseInt(r.intRank ?? "0", 10),
    played: parseInt(r.intPlayed ?? "0", 10),
    won: parseInt(r.intWin ?? "0", 10),
    draw: parseInt(r.intDraw ?? "0", 10),
    lost: parseInt(r.intLoss ?? "0", 10),
    goals_for: parseInt(r.intGoalsFor ?? "0", 10),
    goals_against: parseInt(r.intGoalsAgainst ?? "0", 10),
    goal_diff: parseInt(r.intGoalDifference ?? "0", 10),
    points: parseInt(r.intPoints ?? "0", 10),
  }));

  const { error } = await supabase
    .from("standings")
    .upsert(upsertRows, { onConflict: "competition,group_name,team_name" });

  if (error) console.error("[syncStandings] error", error.message);
  return upsertRows.length;
}

// ─── Full season sync ─────────────────────────────────────────────────────────

export async function syncSeason(): Promise<{ updated: number; inserted: number; total: number }> {
  const supabase = createAdminClient();
  const json = await tsdbFetch(`/eventsseason.php?id=4429&s=2026`);
  const events = json?.events ?? [];

  const { data: matches } = await supabase.from("matches").select("id, team_a, team_b, external_id");
  if (!matches) return { updated: 0, inserted: 0, total: 0 };

  let updated = 0, inserted = 0;

  for (const e of events) {
    const teamAFr = toFrench(e.strHomeTeam ?? "");
    const teamBFr = toFrench(e.strAwayTeam ?? "");
    const externalId = parseInt(e.idEvent, 10);
    const status = tsdbStatus(e);
    const scoreA = e.intHomeScore !== null && e.intHomeScore !== "" ? parseInt(e.intHomeScore, 10) : null;
    const scoreB = e.intAwayScore !== null && e.intAwayScore !== "" ? parseInt(e.intAwayScore, 10) : null;

    const existing =
      matches.find((m) => m.external_id === externalId) ??
      matches.find((m) => m.team_a.toLowerCase() === teamAFr.toLowerCase() && m.team_b.toLowerCase() === teamBFr.toLowerCase());

    const { phase, stage } = normalizePhase(e.strRound ?? e.intRound?.toString());

    if (existing) {
      await supabase.from("matches").update({
        external_id: externalId, status, score_a: scoreA, score_b: scoreB,
        team_a: teamAFr, team_b: teamBFr,
        flag_a: toFlag(e.strHomeTeam ?? ""), flag_b: toFlag(e.strAwayTeam ?? ""),
        phase, stage: stage ?? undefined,
        venue: e.strVenue ?? undefined,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      cache.invalidate(`match:${existing.id}`);
      updated++;
    } else {
      const kickoff = e.strTimestamp ? `${e.strTimestamp}Z` : `${e.dateEvent}T${e.strTime ?? "00:00:00"}Z`;
      const { error } = await supabase.from("matches").insert({
        external_id: externalId, competition: "FIFA World Cup 2026",
        phase, stage: stage ?? undefined,
        team_a: teamAFr, team_b: teamBFr,
        flag_a: toFlag(e.strHomeTeam ?? ""), flag_b: toFlag(e.strAwayTeam ?? ""),
        starts_at: kickoff, channel: "Canal+", status,
        score_a: scoreA, score_b: scoreB,
        venue: e.strVenue ?? undefined,
      });
      if (!error) {
        inserted++;
        matches.push({ id: "", team_a: teamAFr, team_b: teamBFr, external_id: externalId });
      }
    }
  }

  return { updated, inserted, total: events.length };
}
