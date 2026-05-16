// Entry point — returns real or mock provider based on env
import { ApiFootballProvider } from "./api-football";
import { MockFootballProvider } from "./mock";
import { TheSportsDBProvider } from "./thesportsdb";
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
    _provider = new TheSportsDBProvider();
  }
  return _provider;
}
