// Mock provider — used when API_FOOTBALL_KEY is not set or free plan blocks 2026

import type { FootballProvider, LiveMatch, MatchDetail } from "./provider";

const MOCK_LIVE: LiveMatch = {
  external_id: 9999,
  home_team: "France",
  away_team: "Brésil",
  home_flag: "🇫🇷",
  away_flag: "🇧🇷",
  status: "live",
  minute: 67,
  score_home: 1,
  score_away: 1,
  kickoff_at: new Date(Date.now() - 67 * 60000).toISOString(),
  channel: "TF1",
  venue: "MetLife Stadium, New York",
  referee: "Szymon Marciniak",
  competition: "Coupe du Monde 2026",
  phase: "Quart de finale",
};

const MOCK_DETAIL: MatchDetail = {
  match: MOCK_LIVE,
  events: [
    { minute: 23, type: "goal", player_name: "Kylian Mbappé", team: "home", detail: "Normal Goal" },
    { minute: 41, type: "yellow_card", player_name: "Casemiro", team: "away", detail: "Foul" },
    { minute: 58, type: "goal", player_name: "Vinícius Jr.", team: "away", detail: "Normal Goal" },
    { minute: 63, type: "substitution", player_name: "Dembélé → Camavinga", team: "home", detail: "" },
  ],
  lineups: {
    home: {
      team: "home", formation: "4-3-3", coach: "Didier Deschamps",
      players: [
        { player_name: "Mike Maignan", shirt_number: 16, position: "G", is_starting: true },
        { player_name: "Jules Koundé", shirt_number: 5, position: "D", is_starting: true },
        { player_name: "Dayot Upamecano", shirt_number: 4, position: "D", is_starting: true },
        { player_name: "William Saliba", shirt_number: 17, position: "D", is_starting: true },
        { player_name: "Theo Hernandez", shirt_number: 22, position: "D", is_starting: true },
        { player_name: "N'Golo Kanté", shirt_number: 13, position: "M", is_starting: true },
        { player_name: "Aurélien Tchouaméni", shirt_number: 8, position: "M", is_starting: true },
        { player_name: "Antoine Griezmann", shirt_number: 7, position: "M", is_starting: true },
        { player_name: "Ousmane Dembélé", shirt_number: 11, position: "F", is_starting: true },
        { player_name: "Kylian Mbappé", shirt_number: 10, position: "F", is_starting: true },
        { player_name: "Marcus Thuram", shirt_number: 9, position: "F", is_starting: true },
        { player_name: "Eduardo Camavinga", shirt_number: 14, position: "M", is_starting: false },
        { player_name: "Randal Kolo Muani", shirt_number: 23, position: "F", is_starting: false },
      ],
    },
    away: {
      team: "away", formation: "4-2-3-1", coach: "Dorival Júnior",
      players: [
        { player_name: "Alisson", shirt_number: 1, position: "G", is_starting: true },
        { player_name: "Danilo", shirt_number: 2, position: "D", is_starting: true },
        { player_name: "Marquinhos", shirt_number: 4, position: "D", is_starting: true },
        { player_name: "Gabriel Magalhães", shirt_number: 5, position: "D", is_starting: true },
        { player_name: "Guilherme Arana", shirt_number: 6, position: "D", is_starting: true },
        { player_name: "Casemiro", shirt_number: 5, position: "M", is_starting: true },
        { player_name: "Bruno Guimarães", shirt_number: 18, position: "M", is_starting: true },
        { player_name: "Raphinha", shirt_number: 19, position: "F", is_starting: true },
        { player_name: "Rodrygo", shirt_number: 11, position: "F", is_starting: true },
        { player_name: "Vinícius Jr.", shirt_number: 20, position: "F", is_starting: true },
        { player_name: "Endrick", shirt_number: 9, position: "F", is_starting: true },
        { player_name: "Lucas Paquetá", shirt_number: 10, position: "M", is_starting: false },
      ],
    },
  },
  stats: [
    { stat_type: "Possession", home_value: "54%", away_value: "46%" },
    { stat_type: "Tirs", home_value: "12", away_value: "9" },
    { stat_type: "Tirs cadrés", home_value: "5", away_value: "4" },
    { stat_type: "Corners", home_value: "6", away_value: "3" },
    { stat_type: "Fautes", home_value: "11", away_value: "14" },
    { stat_type: "Hors-jeux", home_value: "2", away_value: "1" },
  ],
};

export class MockFootballProvider implements FootballProvider {
  async getLiveMatches(): Promise<LiveMatch[]> {
    return [MOCK_LIVE];
  }
  async getMatchDetail(): Promise<MatchDetail> {
    return MOCK_DETAIL;
  }
  async getUpcomingMatches(): Promise<LiveMatch[]> {
    return [];
  }
}

export const mockFootball = new MockFootballProvider();
