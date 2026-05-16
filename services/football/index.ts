// Public API of the football service layer
export { getMatchDetail, syncLiveScores, syncSeason } from "./sync";
export { cache, TTL, matchTTL } from "./cache";
export { shouldPollLive, pollIntervalMs, dedupe } from "./polling";
export type { FullMatchDetail, FootballMatch, MatchEvent, LineupPlayer, MatchStat, StandingRow } from "./types";
