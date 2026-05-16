// Converts raw TheSportsDB API responses to internal FootballMatch types
// Change provider → only update transformers, app stays untouched

import { toFrench } from "@/lib/football/team-names";
import type { MatchStatus, EventType, TeamSide, MatchEvent, LineupPlayer, MatchStat, StandingRow } from "./types";

const FLAGS: Record<string, string> = {
  "États-Unis": "🇺🇸", "USA": "🇺🇸", "Mexique": "🇲🇽", "Brésil": "🇧🇷",
  "Argentine": "🇦🇷", "Colombie": "🇨🇴", "Équateur": "🇪🇨", "Paraguay": "🇵🇾",
  "Uruguay": "🇺🇾", "Canada": "🇨🇦", "Panama": "🇵🇦", "Haïti": "🇭🇹",
  "France": "🇫🇷", "Espagne": "🇪🇸", "Allemagne": "🇩🇪", "Angleterre": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Portugal": "🇵🇹", "Pays-Bas": "🇳🇱", "Belgique": "🇧🇪", "Italie": "🇮🇹",
  "Suisse": "🇨🇭", "Croatie": "🇭🇷", "Danemark": "🇩🇰", "Suède": "🇸🇪",
  "Pologne": "🇵🇱", "Serbie": "🇷🇸", "Ukraine": "🇺🇦", "Écosse": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "République Tchèque": "🇨🇿", "Turquie": "🇹🇷", "Bosnie-Herzégovine": "🇧🇦",
  "Maroc": "🇲🇦", "Sénégal": "🇸🇳", "Nigéria": "🇳🇬", "Côte d'Ivoire": "🇨🇮",
  "Cameroun": "🇨🇲", "Algérie": "🇩🇿", "Tunisie": "🇹🇳", "Égypte": "🇪🇬",
  "Afrique du Sud": "🇿🇦", "Cap-Vert": "🇨🇻", "Japon": "🇯🇵",
  "Corée du Sud": "🇰🇷", "Arabie Saoudite": "🇸🇦", "Iran": "🇮🇷",
  "Qatar": "🇶🇦", "Australie": "🇦🇺", "Nouvelle-Zélande": "🇳🇿",
  "Curaçao": "🇨🇼", "Corée du Nord": "🇰🇵",
};

export function flagFor(nameFr: string, nameEn?: string): string {
  return FLAGS[nameFr] ?? FLAGS[nameEn ?? ""] ?? "🏳️";
}

// ─── TheSportsDB transformers ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tsdbStatus(e: any): MatchStatus {
  const s = e.strStatus ?? "";
  if (["Match Finished", "FT", "AOT", "Pen"].includes(s)) return "finished";
  if (["HT", "Half Time"].includes(s)) return "halftime";
  if (["1H", "2H", "ET", "P", "In Progress"].includes(s)) return "live";
  if (["Postponed", "Cancelled", "ABD"].includes(s)) return "postponed";
  return "upcoming";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tsdbEventType(raw: any): EventType {
  const t = (raw.strType ?? "").toLowerCase();
  const d = (raw.strDetail ?? "").toLowerCase();
  if (t.includes("goal") && d.includes("own")) return "goal";
  if (t.includes("goal")) return "goal";
  if (t.includes("yellow")) return "yellow_card";
  if (t.includes("red") || d.includes("red")) return "red_card";
  if (t.includes("sub") || t.includes("substitut")) return "substitution";
  if (t.includes("var")) return "var";
  if (d.includes("missed pen") || d.includes("penalty missed")) return "penalty_missed";
  if (d.includes("pen")) return "penalty";
  return "goal";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tsdbTimeline(events: any[], matchId: string, homeExtId: string): MatchEvent[] {
  return (events ?? []).map((e) => ({
    match_id: matchId,
    minute: parseInt(e.intProgress ?? "0", 10),
    team_side: (e.idTeam === homeExtId ? "home" : "away") as TeamSide,
    player_name: e.strPlayer ?? "",
    assist_player_name: e.strAssist ?? undefined,
    type: tsdbEventType(e),
    detail: e.strDetail ?? "",
  }));
}

// ─── API-Football transformers ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apifStatus(short: string): MatchStatus {
  const map: Record<string, MatchStatus> = {
    NS: "upcoming", TBD: "upcoming",
    "1H": "live", "2H": "live", ET: "live", P: "live", BT: "live",
    HT: "halftime",
    FT: "finished", AET: "finished", PEN: "finished", AWD: "finished",
    PST: "postponed", SUSP: "postponed", ABD: "postponed",
  };
  return map[short] ?? "upcoming";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apifEventType(type: string, detail: string): EventType {
  if (type === "Goal") return "goal";
  if (type === "Card" && detail === "Yellow Card") return "yellow_card";
  if (type === "Card" && detail?.includes("Red")) return "red_card";
  if (type === "subst") return "substitution";
  if (type === "Var") return "var";
  if (detail === "Missed Penalty") return "penalty_missed";
  if (detail?.includes("Penalty")) return "penalty";
  return "goal";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apifEvents(raw: any[], matchId: string, homeTeamId: number): MatchEvent[] {
  return (raw ?? []).map((e) => ({
    match_id: matchId,
    minute: e.time?.elapsed ?? 0,
    extra_minute: e.time?.extra ?? undefined,
    team_side: (e.team?.id === homeTeamId ? "home" : "away") as TeamSide,
    player_name: e.player?.name ?? "",
    assist_player_name: e.assist?.name ?? undefined,
    type: apifEventType(e.type, e.detail),
    detail: e.detail ?? "",
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apifLineup(raw: any, side: TeamSide, matchId: string): LineupPlayer[] {
  const starters = (raw.startXI ?? []).map((p: any) => ({
    match_id: matchId,
    team_side: side,
    player_name: p.player?.name ?? "",
    shirt_number: p.player?.number ?? 0,
    position: p.player?.pos ?? "",
    is_starting: true,
  }));
  const subs = (raw.substitutes ?? []).map((p: any) => ({
    match_id: matchId,
    team_side: side,
    player_name: p.player?.name ?? "",
    shirt_number: p.player?.number ?? 0,
    position: p.player?.pos ?? "",
    is_starting: false,
  }));
  return [...starters, ...subs];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apifStats(homeStats: any[], awayStats: any[], matchId: string): MatchStat[] {
  return (homeStats ?? []).map((s: any, i: number) => ({
    match_id: matchId,
    stat_type: s.type,
    home_value: String(s.value ?? 0),
    away_value: String(awayStats[i]?.value ?? 0),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apifStandings(raw: any[]): StandingRow[] {
  return (raw ?? []).flatMap((group: any) =>
    (group.league?.standings?.[0] ?? []).map((row: any) => ({
      team_name: row.team?.name ?? "",
      team_name_fr: toFrench(row.team?.name ?? ""),
      team_flag: flagFor(toFrench(row.team?.name ?? ""), row.team?.name),
      group_name: group.league?.round ?? "Groupe",
      played: row.all?.played ?? 0,
      won: row.all?.win ?? 0,
      draw: row.all?.draw ?? 0,
      lost: row.all?.lose ?? 0,
      goals_for: row.all?.goals?.for ?? 0,
      goals_against: row.all?.goals?.against ?? 0,
      goal_diff: row.goalsDiff ?? 0,
      points: row.points ?? 0,
      rank: row.rank ?? 0,
    }))
  );
}
