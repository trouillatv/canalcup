// Entry point — returns the football provider required by the app.
import { ApiFootballProvider } from "./api-football";
import { MockFootballProvider } from "./mock";
import type { FootballProvider } from "./provider";

export type { FootballProvider, LiveMatch, MatchDetail, MatchEvent, MatchLineup, MatchStat } from "./provider";

let _provider: FootballProvider | null = null;

export function getFootballProvider(): FootballProvider {
  if (_provider) return _provider;
  if (process.env.MOCK_FOOTBALL === "true") {
    _provider = new MockFootballProvider();
  } else if (process.env.API_FOOTBALL_KEY) {
    _provider = new ApiFootballProvider();
  } else {
    throw new Error("API_FOOTBALL_KEY is required for football data");
  }
  return _provider;
}
