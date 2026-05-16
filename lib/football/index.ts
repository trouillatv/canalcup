// Entry point — returns real or mock provider based on env
import { ApiFootballProvider } from "./api-football";
import { MockFootballProvider } from "./mock";
import type { FootballProvider } from "./provider";

export type { FootballProvider, LiveMatch, MatchDetail, MatchEvent, MatchLineup, MatchStat } from "./provider";

let _provider: FootballProvider | null = null;

export function getFootballProvider(): FootballProvider {
  if (_provider) return _provider;
  if (process.env.API_FOOTBALL_KEY && process.env.MOCK_FOOTBALL !== "true") {
    _provider = new ApiFootballProvider();
  } else {
    _provider = new MockFootballProvider();
  }
  return _provider;
}
