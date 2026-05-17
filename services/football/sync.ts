// Sync service — writes football data from provider into Supabase
// Provider selection: API-Football (when key set) > TheSportsDB (free) > Mock

import { createAdminClient } from "@/lib/supabase/admin";
import { cache, matchTTL, TTL } from "./cache";
import { tsdbTimeline, tsdbStatus, apifEvents, apifLineup, apifStats, apifStatus } from "./transformers";
import { toFrench, toFlag } from "@/lib/football/team-names";
import type { FullMatchDetail, MatchEvent, LineupPlayer, MatchStat } from "./types";

const TSDB = "https://www.thesportsdb.com/api/v1/json/3";
const APIF = "https://v3.football.api-sports.io";
const APIF_WC_LEAGUE = 1;
const APIF_WC_SEASON = 2026;

const hasApiFootball = () => !!process.env.API_FOOTBALL_KEY;

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function tsdbFetch(path: string) {
  const res = await fetch(`${TSDB}${path}`, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  return res.json();
}

async function apifFetch(path: string) {
  const res = await fetch(`${APIF}${path}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY! },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  // API-Football returns errors in response body
  if (json.errors && Object.keys(json.errors).length > 0) {
    console.warn(`[apif] error on ${path}:`, json.errors);
    return null;
  }
  return json;
}

// ─── Phase normalization ──────────────────────────────────────────────────────

function normalizePhase(strRound?: string): { phase: string; stage: string | null } {
  if (!strRound) return { phase: "Groupe", stage: null };
  // A bare number is a group-stage matchday (round 1/2/3), NOT a group letter.
  if (/^\d+$/.test(strRound.trim())) return { phase: "Groupe", stage: null };
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

// ─── Live scores — API-Football (real-time) or TheSportsDB ───────────────────

export async function syncLiveScores(): Promise<number> {
  return hasApiFootball() ? syncLiveScoresApiF() : syncLiveScoresTsdb();
}

async function syncLiveScoresApiF(): Promise<number> {
  const supabase = createAdminClient();
  const json = await apifFetch(`/fixtures?live=all&league=${APIF_WC_LEAGUE}&season=${APIF_WC_SEASON}`);
  const fixtures = json?.response ?? [];
  if (!fixtures.length) return 0;

  let synced = 0;
  for (const f of fixtures) {
    const teamAFr = toFrench(f.teams.home.name);
    const teamBFr = toFrench(f.teams.away.name);
    const status = apifStatus(f.fixture.status.short);
    const minute = f.fixture.status.elapsed ?? null;
    const scoreA = f.goals.home ?? null;
    const scoreB = f.goals.away ?? null;
    const apifId: number = f.fixture.id;

    // Match by apif_id first, then by team names
    let { data: match } = await supabase
      .from("matches").select("id").eq("apif_id", apifId).single();

    if (!match) {
      const { data } = await supabase
        .from("matches").select("id")
        .ilike("team_a", `%${teamAFr}%`)
        .ilike("team_b", `%${teamBFr}%`)
        .single();
      match = data;
    }

    if (!match) continue;

    await supabase.from("matches").update({
      apif_id: apifId, status, minute,
      score_a: scoreA, score_b: scoreB,
      venue: f.fixture.venue?.name ?? undefined,
      referee: f.fixture.referee ?? undefined,
      updated_at: new Date().toISOString(),
    }).eq("id", match.id);

    // Sync events in background
    if (apifId) await syncEventsApiF(match.id, apifId, f.teams.home.id);

    cache.invalidate(`match:${match.id}`);
    synced++;
  }
  return synced;
}

async function syncLiveScoresTsdb(): Promise<number> {
  const supabase = createAdminClient();
  const { data: liveMatches } = await supabase
    .from("matches").select("id, external_id, status, team_a, team_b")
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
      status, minute, score_a: scoreA, score_b: scoreB,
      venue: e.strVenue ?? undefined,
      referee: e.strOfficial ?? undefined,
      updated_at: new Date().toISOString(),
    }).eq("id", m.id);

    if (m.external_id) await syncEventsTsdb(m.id, m.external_id, e.idHomeTeam ?? "");

    cache.invalidate(`match:${m.id}`);
    synced++;
  }
  return synced;
}

// ─── Events sync ─────────────────────────────────────────────────────────────

async function syncEventsApiF(matchId: string, apifId: number, homeTeamId: number): Promise<MatchEvent[]> {
  const supabase = createAdminClient();
  const json = await apifFetch(`/fixtures/events?fixture=${apifId}`);
  const events = apifEvents(json?.response ?? [], matchId, homeTeamId);
  if (events.length > 0) {
    await supabase.from("match_events").delete().eq("match_id", matchId);
    await supabase.from("match_events").insert(events);
  }
  return events;
}

async function syncEventsTsdb(matchId: string, externalId: number, homeExtId: string): Promise<MatchEvent[]> {
  const supabase = createAdminClient();
  const json = await tsdbFetch(`/lookuptimeline.php?id=${externalId}`);
  const events = tsdbTimeline(json?.timeline ?? [], matchId, homeExtId);
  if (events.length > 0) {
    await supabase.from("match_events").delete().eq("match_id", matchId);
    await supabase.from("match_events").insert(events);
  }
  return events;
}

// ─── Lineups sync ─────────────────────────────────────────────────────────────

async function syncLineupsApiF(matchId: string, apifId: number): Promise<LineupPlayer[] | null> {
  const supabase = createAdminClient();
  const json = await apifFetch(`/fixtures/lineups?fixture=${apifId}`);
  const raw = json?.response ?? [];
  if (raw.length < 2) return null;

  const home = apifLineup(raw[0], "home", matchId);
  const away = apifLineup(raw[1], "away", matchId);
  const players = [...home, ...away];

  await supabase.from("match_lineups").delete().eq("match_id", matchId);
  await supabase.from("match_lineups").insert(players);
  return players;
}

async function syncLineupsTsdb(matchId: string, externalId: number): Promise<LineupPlayer[] | null> {
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

// ─── Stats sync ───────────────────────────────────────────────────────────────

async function syncStatsApiF(matchId: string, apifId: number): Promise<MatchStat[]> {
  const supabase = createAdminClient();
  const json = await apifFetch(`/fixtures/statistics?fixture=${apifId}`);
  const raw = json?.response ?? [];
  if (raw.length < 2) return [];

  const stats = apifStats(raw[0].statistics, raw[1].statistics, matchId);
  if (stats.length > 0) {
    await supabase.from("match_stats").delete().eq("match_id", matchId);
    await supabase.from("match_stats").insert(stats);
  }
  return stats;
}

async function loadStatsFromDB(matchId: string): Promise<MatchStat[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("match_stats").select("*").eq("match_id", matchId);
  return (data ?? []) as MatchStat[];
}

// ─── Full match detail ────────────────────────────────────────────────────────

export async function getMatchDetail(matchId: string): Promise<FullMatchDetail | null> {
  const cacheKey = `match:${matchId}`;
  const cached = cache.get<FullMatchDetail>(cacheKey);
  if (cached) return cached;

  const supabase = createAdminClient();
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) return null;

  const status = match.status ?? "upcoming";
  const externalId = match.external_id;
  const apifId: number | null = match.apif_id ?? null;
  const isActive = status === "live" || status === "halftime" || status === "finished";

  // ── Events ────────────────────────────────────────────────────────────────
  let events: MatchEvent[] = [];
  const { data: dbEvents } = await supabase
    .from("match_events").select("*").eq("match_id", matchId).order("minute", { ascending: true });

  if (dbEvents?.length) {
    events = dbEvents as MatchEvent[];
  } else if (isActive) {
    if (apifId && hasApiFootball()) {
      events = await syncEventsApiF(matchId, apifId, 0);
    } else if (externalId) {
      events = await syncEventsTsdb(matchId, externalId, "");
    }
  }

  // ── Lineups ───────────────────────────────────────────────────────────────
  const { data: dbLineups } = await supabase
    .from("match_lineups").select("*").eq("match_id", matchId);

  let lineups: FullMatchDetail["lineups"] = null;
  if (dbLineups?.length) {
    const home = dbLineups.filter((p) => p.team_side === "home") as LineupPlayer[];
    const away = dbLineups.filter((p) => p.team_side === "away") as LineupPlayer[];
    lineups = { home, away };
  } else if (isActive) {
    let players: LineupPlayer[] | null = null;
    if (apifId && hasApiFootball()) {
      players = await syncLineupsApiF(matchId, apifId);
    } else if (externalId) {
      players = await syncLineupsTsdb(matchId, externalId);
    }
    if (players) {
      lineups = {
        home: players.filter((p) => p.team_side === "home"),
        away: players.filter((p) => p.team_side === "away"),
      };
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  let stats = await loadStatsFromDB(matchId);
  if (!stats.length && isActive && apifId && hasApiFootball()) {
    stats = await syncStatsApiF(matchId, apifId);
  }

  // ── Standings ─────────────────────────────────────────────────────────────
  let standings;
  if (match.phase === "Groupe" || match.phase === "Group Stage") {
    const { data: rows } = await supabase
      .from("standings").select("*")
      .eq("competition", "FIFA World Cup 2026")
      .order("points", { ascending: false });
    standings = rows ?? undefined;
  }

  const detail: FullMatchDetail = {
    match: {
      id: match.id, external_id: match.external_id, competition: match.competition,
      phase: match.phase, stage: match.stage, team_a: match.team_a, team_b: match.team_b,
      flag_a: match.flag_a, flag_b: match.flag_b, score_a: match.score_a, score_b: match.score_b,
      status: match.status, minute: match.minute, starts_at: match.starts_at,
      venue: match.venue, referee: match.referee, channel: match.channel,
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

// ─── Standings sync ───────────────────────────────────────────────────────────

export async function syncStandings(): Promise<number> {
  return hasApiFootball() ? syncStandingsApiF() : syncStandingsTsdb();
}

async function syncStandingsApiF(): Promise<number> {
  const supabase = createAdminClient();
  const json = await apifFetch(`/standings?league=${APIF_WC_LEAGUE}&season=${APIF_WC_SEASON}`);
  const raw = json?.response ?? [];
  if (!raw.length) return 0;

  // API-Football returns standings nested under league.standings
  const upsertRows = (raw[0]?.league?.standings ?? []).flat().map((row: any) => ({
    competition: "FIFA World Cup 2026",
    group_name: row.group ?? "Group A",
    team_name: row.team?.name ?? "",
    team_name_fr: toFrench(row.team?.name ?? ""),
    team_flag: toFlag(row.team?.name ?? ""),
    rank: row.rank ?? 0,
    played: row.all?.played ?? 0,
    won: row.all?.win ?? 0,
    draw: row.all?.draw ?? 0,
    lost: row.all?.lose ?? 0,
    goals_for: row.all?.goals?.for ?? 0,
    goals_against: row.all?.goals?.against ?? 0,
    goal_diff: row.goalsDiff ?? 0,
    points: row.points ?? 0,
  }));

  if (!upsertRows.length) return 0;
  await supabase.from("standings").upsert(upsertRows, { onConflict: "competition,group_name,team_name" });
  return upsertRows.length;
}

async function syncStandingsTsdb(): Promise<number> {
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

  await supabase.from("standings").upsert(upsertRows, { onConflict: "competition,group_name,team_name" });
  return upsertRows.length;
}

// ─── Full season sync — TheSportsDB (free fixture list) + API-Football IDs ───

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
    const { phase, stage } = normalizePhase(e.strRound ?? e.intRound?.toString());

    const existing =
      matches.find((m) => m.external_id === externalId) ??
      matches.find((m) =>
        m.team_a.toLowerCase() === teamAFr.toLowerCase() &&
        m.team_b.toLowerCase() === teamBFr.toLowerCase()
      );

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
      const { data: inserted_match, error } = await supabase.from("matches").insert({
        external_id: externalId, competition: "FIFA World Cup 2026",
        phase, stage: stage ?? undefined,
        team_a: teamAFr, team_b: teamBFr,
        flag_a: toFlag(e.strHomeTeam ?? ""), flag_b: toFlag(e.strAwayTeam ?? ""),
        starts_at: kickoff, channel: "Canal+", status,
        score_a: scoreA, score_b: scoreB,
        venue: e.strVenue ?? undefined,
      }).select("id").single();
      if (!error && inserted_match) {
        inserted++;
        matches.push({ id: inserted_match.id, team_a: teamAFr, team_b: teamBFr, external_id: externalId });
      }
    }
  }

  // If API-Football key set, backfill apif_id on all matches
  if (hasApiFootball()) {
    await backfillApifIds(matches as { id: string; team_a: string; team_b: string }[]);
  }

  return { updated, inserted, total: events.length };
}

// ─── Backfill API-Football IDs on matches ─────────────────────────────────────

async function backfillApifIds(dbMatches: { id: string; team_a: string; team_b: string }[]) {
  const supabase = createAdminClient();
  const json = await apifFetch(`/fixtures?league=${APIF_WC_LEAGUE}&season=${APIF_WC_SEASON}`);
  const fixtures = json?.response ?? [];
  if (!fixtures.length) return;

  for (const f of fixtures) {
    const teamAFr = toFrench(f.teams.home.name);
    const teamBFr = toFrench(f.teams.away.name);
    const apifId: number = f.fixture.id;

    const match = dbMatches.find(
      (m) => m.team_a.toLowerCase() === teamAFr.toLowerCase() &&
             m.team_b.toLowerCase() === teamBFr.toLowerCase()
    );

    if (match) {
      await supabase.from("matches").update({ apif_id: apifId }).eq("id", match.id).is("apif_id", null);
    }
  }
}
