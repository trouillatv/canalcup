// Public API of the football service layer
export { getMatchDetail, syncLiveScores, syncSeason, syncStandings, syncStandingsFromMatches } from "./sync";
export { cache, TTL, matchTTL } from "./cache";
export { shouldPollLive, pollIntervalMs, dedupe } from "./polling";
export type { FullMatchDetail, FootballMatch, MatchEvent, LineupPlayer, MatchStat, PlayerMatchStat, StandingRow } from "./types";
