// Sync service — writes football data from API-Football into Supabase.
// Mock is reserved for explicit local test mode.

import { createAdminClient } from "@/lib/supabase/admin";
import { cache, matchTTL, TTL } from "./cache";
import { tsdbTimeline, tsdbStatus, apifEvents, apifLineup, apifStats, apifPlayerStats, apifStatus } from "./transformers";
import { toFrench, toFlag } from "@/lib/football/team-names";
import { groupLetterForTeam } from "@/lib/football/groups-2026";
import { generatePlayerRatings } from "@/services/ai/generators/player-ratings";
import type { FullMatchDetail, MatchEvent, LineupPlayer, MatchStat, PlayerMatchStat, StandingRow } from "./types";

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

// ─── Live scores — API-Football only ──────────────────────────────────────────

export async function syncLiveScores(): Promise<number> {
  if (!hasApiFootball()) throw new Error("API_FOOTBALL_KEY is required for football sync");
  return syncLiveScoresApiF();
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
    await stampFinishedAt(supabase, match.id, status);

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
    await stampFinishedAt(supabase, m.id, status);

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

// ─── Player stats / notes ─────────────────────────────────────────────────────

async function loadPlayerStatsFromDB(matchId: string): Promise<PlayerMatchStat[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("player_match_stats").select("*").eq("match_id", matchId)
    .order("rating", { ascending: false, nullsFirst: false });
  return (data ?? []) as PlayerMatchStat[];
}

async function upsertPlayerStats(rows: PlayerMatchStat[]): Promise<PlayerMatchStat[]> {
  if (!rows.length) return [];
  const supabase = createAdminClient();
  await supabase
    .from("player_match_stats")
    .upsert(rows, { onConflict: "match_id,team_side,player_name" });
  return rows;
}

// API-Football : notes & stats réelles (/fixtures/players).
async function syncPlayerStatsApiF(matchId: string, apifId: number): Promise<PlayerMatchStat[]> {
  const json = await apifFetch(`/fixtures/players?fixture=${apifId}`);
  const raw = json?.response ?? [];
  if (raw.length < 2) return [];
  const rows = apifPlayerStats(raw[0], raw[1], matchId);
  return upsertPlayerStats(rows);
}

// Fallback : notes ESTIMÉES (Gemini ou heuristique) — match fini, compos connues.
async function syncPlayerRatingsEstimate(
  matchId: string,
  match: { team_a: string; team_b: string; score_a: number | null; score_b: number | null; phase: string },
  events: MatchEvent[],
  lineups: { home: LineupPlayer[]; away: LineupPlayer[] }
): Promise<PlayerMatchStat[]> {
  const rows = await generatePlayerRatings({
    matchId,
    teamA: match.team_a,
    teamB: match.team_b,
    scoreA: match.score_a ?? 0,
    scoreB: match.score_b ?? 0,
    phase: match.phase ?? "Groupe",
    events,
    homeLineup: lineups.home,
    awayLineup: lineups.away,
  });
  return upsertPlayerStats(rows);
}

// Horodate le coup de sifflet final UNE SEULE FOIS : dès qu'on observe le
// statut "finished", on stampe finished_at s'il est encore nul, et on ne le
// déplace jamais ensuite (les resyncs post-match ne doivent pas le repousser).
// C'est le point de départ de la fenêtre "Terminé" du flash. On ne force JAMAIS
// le statut : si le provider ne renvoie pas "finished" (ex. quota API épuisé),
// finished_at reste nul et aucun "Terminé" n'est annoncé à tort.
async function stampFinishedAt(
  supabase: ReturnType<typeof createAdminClient>,
  matchId: string,
  status: string
): Promise<void> {
  if (status !== "finished") return;
  await supabase
    .from("matches")
    .update({ finished_at: new Date().toISOString() })
    .eq("id", matchId)
    .is("finished_at", null);
}

// Rafraîchit la ligne matches (score/statut/minute) pour UN match, on-read.
// Retourne l'ID APIF de l'équipe home quand disponible (nécessaire pour
// assigner team_side correctement dans syncEventsApiF).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function refreshMatchRow(match: any): Promise<{ apifHomeId?: number; tsdbHomeId?: string } | null> {
  const supabase = createAdminClient();
  if (match.apif_id && hasApiFootball()) {
    const json = await apifFetch(`/fixtures?id=${match.apif_id}`);
    const f = json?.response?.[0];
    if (!f) return null;
    const status = apifStatus(f.fixture.status.short);
    await supabase.from("matches").update({
      status,
      minute: f.fixture.status.elapsed ?? null,
      score_a: f.goals.home ?? null,
      score_b: f.goals.away ?? null,
      venue: f.fixture.venue?.name ?? undefined,
      referee: f.fixture.referee ?? undefined,
      updated_at: new Date().toISOString(),
    }).eq("id", match.id);
    await stampFinishedAt(supabase, match.id, status);
    return { apifHomeId: f.teams.home.id as number };
  }
  return null;
}

// ─── Resync on-read (sans cron — compatible plan Hobby) ───────────────────────
//
// Pendant le live et la fenêtre post-match, une lecture de la fiche déclenche
// un resync serveur (jamais depuis le frontend), throttlé pour ne pas marteler
// le provider : ≤ toutes les 5 min en live, ≤ toutes les 30 min après le coup
// de sifflet (couvre les passes « final », « +30 min », « +2 h corrigées »).

const RESYNC_FINISHED_MS = 30 * 60_000;
const RESYNC_LIVE_FALLBACK_MS = 5 * 60_000;
const POST_MATCH_WINDOW_MS = 5 * 60 * 60_000; // ~kickoff + 5 h : couvre le +2 h

// ── Budget quotidien API-Football (forfait payant = 7500/j ; on vise 4000 max,
// large marge sous le plafond). Au-delà, apifRemainingToday tombe à 0 et le
// resync live s'étale au MAX : c'est ce qui bridait tout à 90/j auparavant. ──
const DAILY_CALL_BUDGET = 4000;
const CALLS_PER_LIVE_RESYNC = 3; // refreshMatchRow + events + stats par resync live
const MATCH_MINUTES = 90;        // durée de jeu d'un match (référence du budget)
const MIN_RESYNC_MS = 90_000;    // jamais sous 90 s, même avec beaucoup de quota
const MAX_RESYNC_MS = 20 * 60_000;

function inResyncWindow(status: string, startsAt: string): boolean {
  if (status === "live" || status === "halftime") return true;
  const elapsed = Date.now() - new Date(startsAt).getTime();
  // Coup d'envoi passé mais encore "upcoming" en base : on resync à la lecture
  // pour faire passer le match "live" tout seul, sans attendre le cron quotidien.
  if (status === "upcoming") return elapsed >= 0 && elapsed < POST_MATCH_WINDOW_MS;
  if (status === "finished") return elapsed >= 0 && elapsed < POST_MATCH_WINDOW_MS;
  return false;
}

// Verrou anti-doublon CONCURRENT (court, par instance). Le vrai throttle est
// basé sur matches.updated_at (fiable en serverless) + l'intervalle adaptatif.
function takeResyncSlot(matchId: string): boolean {
  const key = `resync:${matchId}`;
  if (cache.get(key)) return false;
  cache.set(key, true, 30_000);
  return true;
}

// Appels restants aujourd'hui via /status API-Football (caché 60 s ; /status
// ne consomme pas le quota). On vise DAILY_CALL_BUDGET (90).
async function apifRemainingToday(): Promise<number> {
  const key = "apif:remaining";
  const c = cache.get<number>(key);
  if (typeof c === "number") return c;
  let remaining = DAILY_CALL_BUDGET;
  try {
    const j = await apifFetch("/status");
    const used = j?.response?.requests?.current ?? 0;
    remaining = Math.max(0, DAILY_CALL_BUDGET - used);
  } catch { /* prudent en cas d'échec */ }
  cache.set(key, remaining, 60_000);
  return remaining;
}

export type LiveSyncBudget = {
  callsRemaining: number;   // appels restants aujourd'hui (réel, via /status)
  matchesLive: number;      // matchs en cours maintenant
  matchesUpcoming: number;  // matchs à venir aujourd'hui (NC)
  playMinutesRemaining: number; // minutes de jeu restantes à couvrir (90/match)
  resyncsAffordable: number;    // nb de resyncs qu'on peut encore se payer
  intervalSeconds: number;      // intervalle de resync recommandé maintenant
};

// Budget de resync ADAPTATIF, recalculé À CHAQUE LECTURE (jamais figé en début
// de journée) : on relit le quota réel restant (/status) ET l'état courant des
// matchs (en cours + à venir aujourd'hui), chaque match valant MATCH_MINUTES
// (90 min) de jeu. On répartit le quota restant sur les minutes restantes :
// 1 match seul ⇒ on tire vite ; plusieurs matchs ⇒ on étale pour tenir ≤ 90/j.
export async function getLiveSyncBudget(
  supabase: ReturnType<typeof createAdminClient>
): Promise<LiveSyncBudget> {
  const callsRemaining = await apifRemainingToday();
  let matchesLive = 0;
  let matchesUpcoming = 0;
  let playMinutesRemaining = 0;
  try {
    // Journée calendaire en Nouvelle-Calédonie (UTC+11) : un match à 06:00 NC
    // = 19:00 UTC la veille, il DOIT être compté dans "aujourd'hui".
    const NC_OFFSET = 11 * 60 * 60_000;
    const nowNc = new Date(Date.now() + NC_OFFSET);
    const startUtc = new Date(Date.UTC(nowNc.getUTCFullYear(), nowNc.getUTCMonth(), nowNc.getUTCDate()) - NC_OFFSET);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60_000);
    // Filet : on inclut aussi tout match commencé dans les 4 dernières heures
    // (match en cours qui aurait débordé de la borne de jour).
    const lowerBound = new Date(Math.min(startUtc.getTime(), Date.now() - 4 * 60 * 60_000));
    const { data } = await supabase
      .from("matches")
      .select("status, minute, starts_at")
      .gte("starts_at", lowerBound.toISOString())
      .lt("starts_at", endUtc.toISOString());
    for (const m of (data ?? []) as { status: string; minute: number | null; starts_at: string }[]) {
      if (m.status === "live" || m.status === "halftime") {
        matchesLive += 1;
        playMinutesRemaining += Math.max(5, MATCH_MINUTES - (m.minute ?? 0));
      } else if (m.status === "upcoming") {
        matchesUpcoming += 1;
        playMinutesRemaining += MATCH_MINUTES;
      }
    }
  } catch { /* on garde les valeurs par défaut */ }
  if (playMinutesRemaining <= 0) playMinutesRemaining = MATCH_MINUTES;
  const resyncsAffordable = Math.max(1, Math.floor(callsRemaining / CALLS_PER_LIVE_RESYNC));
  const intervalMs = Math.min(
    MAX_RESYNC_MS,
    Math.max(MIN_RESYNC_MS, (playMinutesRemaining / resyncsAffordable) * 60_000)
  );
  return {
    callsRemaining,
    matchesLive,
    matchesUpcoming,
    playMinutesRemaining,
    resyncsAffordable,
    intervalSeconds: Math.round(intervalMs / 1000),
  };
}

// Intervalle de resync pour un match donné, dérivé du budget live ci-dessus.
async function computeResyncIntervalMs(
  supabase: ReturnType<typeof createAdminClient>,
  status: string
): Promise<number> {
  if (status === "finished") return RESYNC_FINISHED_MS;
  try {
    const budget = await getLiveSyncBudget(supabase);
    if (budget.callsRemaining <= CALLS_PER_LIVE_RESYNC) return MAX_RESYNC_MS; // quasi plus de quota
    return budget.intervalSeconds * 1000;
  } catch {
    return RESYNC_LIVE_FALLBACK_MS;
  }
}

// Rafraîchit UNIQUEMENT les LIGNES des matchs en fenêtre live (score/minute/
// statut), throttlé par le même budget adaptatif. Léger : pas d'events/compos/
// stats. Appelé par /api/breaking-news pour que le FLASH suive le direct sur
// TOUTES les pages — sans devoir ouvrir la fiche du match (le resync on-read
// de getMatchDetail ne se déclenche que sur la fiche). La route breaking-news
// est cachée 30 s côté edge → ceci s'exécute ~1×/30 s globalement, et le
// throttle interne plafonne les vrais appels API au budget quotidien.
export async function refreshLiveMatches(): Promise<number> {
  const supabase = createAdminClient();
  // Seuls les matchs dont le coup d'envoi est dans les ~5 dernières heures
  // peuvent être en fenêtre de resync (live, mi-temps, à venir-déjà-débuté,
  // ou fini-récent). Requête bornée donc bon marché.
  const windowStart = new Date(Date.now() - POST_MATCH_WINDOW_MS).toISOString();
  const { data: candidates } = await supabase
    .from("matches")
    .select("id, status, starts_at, updated_at, apif_id, external_id")
    .gte("starts_at", windowStart)
    .lte("starts_at", new Date().toISOString());
  if (!candidates?.length) return 0;

  let refreshed = 0;
  for (const m of candidates) {
    const status = m.status ?? "upcoming";
    if (!inResyncWindow(status, m.starts_at)) continue;
    const intervalMs = await computeResyncIntervalMs(supabase, status);
    const lastUpd = m.updated_at ? new Date(m.updated_at).getTime() : 0;
    if (Date.now() - lastUpd < intervalMs) continue;   // throttle adaptatif
    if (!takeResyncSlot(m.id)) continue;               // anti-doublon concurrent
    try { await refreshMatchRow(m); refreshed++; } catch { /* on continue */ }
  }
  return refreshed;
}

// ─── Full match detail ────────────────────────────────────────────────────────

type GroupMatchRow = {
  team_a: string;
  team_b: string;
  flag_a: string | null;
  flag_b: string | null;
  status: string | null;
  score_a: number | null;
  score_b: number | null;
};

async function loadLiveGroupStandings(
  supabase: ReturnType<typeof createAdminClient>,
  teamA: string
): Promise<StandingRow[] | undefined> {
  // ⚠️ Le champ `stage` ne contient PAS la lettre de poule mais la journée
  // ("Group Stage - 1/2/3"), commune aux 12 groupes. On reconstruit donc le
  // groupe depuis les confrontations : en round-robin à 4, chaque équipe
  // affronte exactement ses 3 adversaires de poule → { teamA } ∪ { adversaires
  // de teamA } = les 4 équipes du groupe. Robuste même quand les noms d'équipes
  // ne sont pas normalisés (FR/EN mélangés en base).
  const { data: allGroup } = await supabase
    .from("matches")
    .select("team_a, team_b, flag_a, flag_b, status, score_a, score_b, stage")
    .eq("phase", "Groupe");

  const groupMatches = ((allGroup ?? []) as (GroupMatchRow & { stage: string | null })[])
    .filter((m) => typeof m.stage === "string" && m.stage.startsWith("Group Stage"));
  if (!groupMatches.length) return undefined;

  // Équipes du groupe de teamA (teamA + ses adversaires)
  const groupTeams = new Set<string>([teamA]);
  for (const m of groupMatches) {
    if (m.team_a === teamA) groupTeams.add(m.team_b);
    else if (m.team_b === teamA) groupTeams.add(m.team_a);
  }
  if (groupTeams.size < 2) return undefined;

  // Ne garder que les rencontres internes au groupe
  const matches = groupMatches.filter(
    (m) => groupTeams.has(m.team_a) && groupTeams.has(m.team_b)
  );
  if (!matches.length) return undefined;

  // Libellé du groupe (lettre officielle) — on tente sur chaque équipe car
  // certains noms en base ne se résolvent pas (variantes API non normalisées).
  let letter: string | null = null;
  for (const t of groupTeams) {
    letter = groupLetterForTeam(t);
    if (letter) break;
  }
  const groupName = letter ? `Groupe ${letter}` : "Classement du groupe";

  type TeamStanding = {
    name: string;
    flag: string;
    played: number;
    won: number;
    draw: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
  };

  const teams = new Map<string, TeamStanding>();
  const ensure = (name: string, flag: string | null): TeamStanding => {
    const existing = teams.get(name);
    if (existing) {
      if (!existing.flag && flag) existing.flag = flag;
      return existing;
    }
    const row = {
      name,
      flag: flag ?? "",
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    };
    teams.set(name, row);
    return row;
  };

  for (const match of matches as GroupMatchRow[]) {
    const home = ensure(match.team_a, match.flag_a);
    const away = ensure(match.team_b, match.flag_b);
    const countsForTable = match.status === "live" || match.status === "halftime" || match.status === "finished";
    if (!countsForTable || match.score_a == null || match.score_b == null) continue;
    const scoreA = match.score_a;
    const scoreB = match.score_b;

    home.played += 1;
    away.played += 1;
    home.goalsFor += scoreA;
    home.goalsAgainst += scoreB;
    away.goalsFor += scoreB;
    away.goalsAgainst += scoreA;

    if (scoreA > scoreB) {
      home.won += 1;
      away.lost += 1;
    } else if (scoreA < scoreB) {
      away.won += 1;
      home.lost += 1;
    } else {
      home.draw += 1;
      away.draw += 1;
    }
  }

  return [...teams.values()]
    .map((team) => {
      const goalDiff = team.goalsFor - team.goalsAgainst;
      return {
        team_name: team.name,
        team_name_fr: team.name,
        team_flag: team.flag,
        group_name: groupName,
        played: team.played,
        won: team.won,
        draw: team.draw,
        lost: team.lost,
        goals_for: team.goalsFor,
        goals_against: team.goalsAgainst,
        goal_diff: goalDiff,
        points: team.won * 3 + team.draw,
        rank: 0,
      };
    })
    .sort((a, b) =>
      b.points - a.points ||
      b.goal_diff - a.goal_diff ||
      b.goals_for - a.goals_for ||
      a.team_name.localeCompare(b.team_name)
    )
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

export async function getMatchDetail(matchId: string): Promise<FullMatchDetail | null> {
  const cacheKey = `match:${matchId}`;
  const cached = cache.get<FullMatchDetail>(cacheKey);
  if (cached) return cached;

  const supabase = createAdminClient();
  let { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) return null;

  // ── Resync on-read (throttle adaptatif quota) : rafraîchit la ligne match ──
  const status0 = match.status ?? "upcoming";
  let doResync = false;
  if (inResyncWindow(status0, match.starts_at)) {
    const intervalMs = await computeResyncIntervalMs(supabase, status0);
    const lastUpd = match.updated_at ? new Date(match.updated_at).getTime() : 0;
    if (Date.now() - lastUpd >= intervalMs) {
      doResync = takeResyncSlot(matchId); // anti-doublon concurrent
    }
  }
  let refreshResult: { apifHomeId?: number; tsdbHomeId?: string } | null = null;
  if (doResync) {
    refreshResult = await refreshMatchRow(match);
    const { data: fresh } = await supabase.from("matches").select("*").eq("id", matchId).single();
    if (fresh) match = fresh;
  }

  const status = match.status ?? "upcoming";
  const externalId = match.external_id;
  const apifId: number | null = match.apif_id ?? null;
  const isActive = status === "live" || status === "halftime" || status === "finished";
  // En fenêtre de resync on re-tire le provider même si la DB a déjà des lignes.
  const force = doResync && isActive;

  // ── Events ────────────────────────────────────────────────────────────────
  let events: MatchEvent[] = [];
  const { data: dbEvents } = await supabase
    .from("match_events").select("*").eq("match_id", matchId).order("minute", { ascending: true });
  events = (dbEvents ?? []) as MatchEvent[];

  // Détecte une corruption connue : si tous les events sont "away" alors qu'il
  // y en a plusieurs, c'est le signe que homeTeamId=0 a été utilisé lors d'un
  // sync précédent. On force une resync pour corriger, même hors fenêtre.
  const allAway = events.length > 1 && events.every((e) => e.team_side === "away");

  if ((!events.length || force || allAway) && isActive) {
    let fresh: MatchEvent[] = [];
    if (apifId && hasApiFootball()) {
      // apifHomeId depuis refreshMatchRow (même fetch fixture) ou fetch dédié.
      let homeTeamId = refreshResult?.apifHomeId ?? 0;
      if (!homeTeamId) {
        const fixtureJson = await apifFetch(`/fixtures?id=${apifId}`);
        homeTeamId = fixtureJson?.response?.[0]?.teams?.home?.id ?? 0;
      }
      fresh = await syncEventsApiF(matchId, apifId, homeTeamId);
    }
    if (fresh.length) events = fresh; // sinon on garde la DB
  }

  // ── Lineups ───────────────────────────────────────────────────────────────
  const { data: dbLineups } = await supabase
    .from("match_lineups").select("*").eq("match_id", matchId);

  let lineups: FullMatchDetail["lineups"] = null;
  const buildLineups = (rows: LineupPlayer[]) => {
    const home = rows.filter((p) => p.team_side === "home");
    const away = rows.filter((p) => p.team_side === "away");
    // role est repurposé pour la formation ("4-3-3") ; on ne l'expose que si
    // ça ressemble vraiment à une formation (d'anciennes données ont role="player").
    const asFormation = (rows: LineupPlayer[]) => {
      const f = rows.find((p) => /^\d+(-\d+)+$/.test(p.role ?? ""))?.role;
      return f ?? undefined;
    };
    return {
      home,
      away,
      home_formation: asFormation(home),
      away_formation: asFormation(away),
    };
  };
  if (dbLineups?.length) lineups = buildLineups(dbLineups as LineupPlayer[]);

  // Compos : on ne les re-tire que si MANQUANTES, ou une fois à la fin du match
  // (subs finaux). Pas à chaque resync live → économie de quota.
  if ((!lineups || (force && status === "finished")) && isActive) {
    let players: LineupPlayer[] | null = null;
    if (apifId && hasApiFootball()) players = await syncLineupsApiF(matchId, apifId);
    if (players?.length) lineups = buildLineups(players); // sinon on garde la DB
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  let stats = await loadStatsFromDB(matchId);
  if ((!stats.length || force) && apifId && hasApiFootball()) {
    const fresh = await syncStatsApiF(matchId, apifId);
    if (fresh.length) stats = fresh;
  }

  // ── Notes joueurs ─────────────────────────────────────────────────────────
  // 1) API-Football si dispo (notes réelles, resynchro post-match incluse).
  // 2) sinon, match fini + compos connues → estimation Gemini/heuristique
  //    (labellisée « estimé » en UI). L'estimation est stable : on ne la
  //    régénère pas tant qu'elle existe (économie budget Gemini).
  // Notes joueurs : lourd → on ne les tire que si MANQUANTES, ou une fois à la
  // fin du match. Pas à chaque resync live → économie de quota.
  let playerStats = await loadPlayerStatsFromDB(matchId);
  // API-Football publie souvent les notes en 2e période, pas au coup d'envoi.
  // On re-tire les notes tant qu'AUCUNE n'est encore là — y compris EN LIVE
  // (pas seulement à la fin) — pour les afficher dès qu'elles sortent. Une fois
  // au moins une note présente, on arrête de marteler (sauf pull final à la fin).
  const hasAnyRating0 = playerStats.some((p) => p.rating != null);
  if ((!playerStats.length || (force && (status === "finished" || !hasAnyRating0))) && apifId && hasApiFootball()) {
    const fresh = await syncPlayerStatsApiF(matchId, apifId);
    if (fresh.length) playerStats = fresh;
  }
  const hasPlayerRatings = playerStats.some((p) => p.rating != null);
  // On génère même sans lineups (mode dégradé : notes des joueurs ayant marqué/carton).
  if ((!playerStats.length || !hasPlayerRatings) && status === "finished" && events.length) {
    playerStats = await syncPlayerRatingsEstimate(
      matchId,
      { team_a: match.team_a, team_b: match.team_b, score_a: match.score_a, score_b: match.score_b, phase: match.phase },
      events,
      lineups ?? { home: [], away: [] }
    );
  }

  // ── Standings ─────────────────────────────────────────────────────────────
  const isGroupMatch = (match.phase === "Groupe" || match.phase === "Group Stage") && !!match.stage;
  const standings = isGroupMatch ? await loadLiveGroupStandings(supabase, match.team_a) : undefined;

  const detail: FullMatchDetail = {
    match: {
      id: match.id, external_id: match.external_id, competition: match.competition,
      phase: match.phase, stage: match.stage,
      // Normalise un libellé fournisseur non traduit ("Czechia" → "République
      // Tchèque") pour l'affichage, le drapeau et le lien vers la fiche effectif.
      team_a: toFrench(match.team_a), team_b: toFrench(match.team_b),
      flag_a: match.flag_a, flag_b: match.flag_b, score_a: match.score_a, score_b: match.score_b,
      status: match.status, minute: match.minute, starts_at: match.starts_at,
      venue: match.venue, referee: match.referee, channel: match.channel,
      is_featured: match.is_featured ?? false,
    },
    events,
    lineups,
    stats,
    playerStats,
    standings,
  };

  cache.set(cacheKey, detail, matchTTL(status));
  return detail;
}

// ─── Standings sync ───────────────────────────────────────────────────────────

export async function syncStandings(): Promise<number> {
  if (!hasApiFootball()) throw new Error("API_FOOTBALL_KEY is required for football sync");
  return syncStandingsApiF();
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

// ─── Full season sync — API-Football only ────────────────────────────────────

export async function syncSeason(): Promise<{ updated: number; inserted: number; total: number }> {
  if (!hasApiFootball()) throw new Error("API_FOOTBALL_KEY is required for football sync");

  const supabase = createAdminClient();
  const json = await apifFetch(`/fixtures?league=${APIF_WC_LEAGUE}&season=${APIF_WC_SEASON}`);
  const fixtures = json?.response ?? [];
  if (!fixtures.length) return { updated: 0, inserted: 0, total: 0 };

  const { data: matches } = await supabase.from("matches").select("id, team_a, team_b, external_id, apif_id");
  if (!matches) return { updated: 0, inserted: 0, total: 0 };

  let updated = 0, inserted = 0;

  for (const f of fixtures) {
    const teamAFr = toFrench(f.teams.home.name);
    const teamBFr = toFrench(f.teams.away.name);
    const apifId: number = f.fixture.id;
    const status = apifStatus(f.fixture.status.short);
    const scoreA = f.goals.home ?? null;
    const scoreB = f.goals.away ?? null;
    const { phase, stage } = normalizePhase(f.league.round ?? undefined);

    const existing =
      matches.find((m) => m.apif_id === apifId) ??
      matches.find((m) => m.external_id === apifId) ??
      matches.find((m) =>
        m.team_a.toLowerCase() === teamAFr.toLowerCase() &&
        m.team_b.toLowerCase() === teamBFr.toLowerCase()
      );

    if (existing) {
      await supabase.from("matches").update({
        external_id: apifId, apif_id: apifId, status, score_a: scoreA, score_b: scoreB,
        team_a: teamAFr, team_b: teamBFr,
        flag_a: toFlag(f.teams.home.name), flag_b: toFlag(f.teams.away.name),
        phase, stage: stage ?? undefined,
        venue: f.fixture.venue?.name ?? undefined,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      cache.invalidate(`match:${existing.id}`);
      updated++;
    } else {
      const { data: inserted_match, error } = await supabase.from("matches").insert({
        external_id: apifId, apif_id: apifId, competition: "FIFA World Cup 2026",
        phase, stage: stage ?? undefined,
        team_a: teamAFr, team_b: teamBFr,
        flag_a: toFlag(f.teams.home.name), flag_b: toFlag(f.teams.away.name),
        starts_at: f.fixture.date, channel: "Canal+", status,
        score_a: scoreA, score_b: scoreB,
        venue: f.fixture.venue?.name ?? undefined,
      }).select("id").single();
      if (!error && inserted_match) {
        inserted++;
        matches.push({ id: inserted_match.id, team_a: teamAFr, team_b: teamBFr, external_id: apifId, apif_id: apifId });
      }
    }
  }

  return { updated, inserted, total: fixtures.length };
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
