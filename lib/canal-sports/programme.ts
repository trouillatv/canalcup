import { DEFAULT_TZ } from "../utils.ts";

export type ProgramStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled" | string;

export type ProgramTeam = {
  id: string | null;
  name: string;
  shortName: string;
  logoUrl: string | null;
};

export type ProgramMatch = {
  id: string;
  startsAt: string;
  status: ProgramStatus;
  stage: string | null;
  matchday: number | null;
  competitionName: string;
  seasonLabel: string | null;
  home: ProgramTeam;
  away: ProgramTeam;
  score: { home: number; away: number } | null;
  prediction?: { status: string; points: number | null } | null;
};

type RawParticipant = {
  id?: string | null;
  name?: string | null;
  short_name?: string | null;
  metadata?: Record<string, unknown> | null;
};

type RawEventParticipant = {
  role?: string | null;
  participants?: RawParticipant | RawParticipant[] | null;
};

export type RawProgramEvent = {
  id: string;
  starts_at: string;
  status: ProgramStatus;
  stage: string | null;
  matchday: number | null;
  result: Record<string, unknown> | null;
  seasons?: {
    label?: string | null;
    competitions?: { name?: string | null } | { name?: string | null }[] | null;
  } | {
    label?: string | null;
    competitions?: { name?: string | null } | { name?: string | null }[] | null;
  }[] | null;
  event_participants: RawEventParticipant[];
};

export function statusLabel(status: ProgramStatus): string {
  switch (status) {
    case "scheduled":
      return "A venir";
    case "live":
      return "En direct";
    case "finished":
      return "Termine";
    case "postponed":
      return "Reporte";
    case "cancelled":
      return "Annule";
    default:
      return status;
  }
}

export function matchdayLabel(matchday: number | null): string | null {
  return matchday ? `Journee ${matchday}` : null;
}

export function stageLabel(stage: string | null, matchday: number | null): string {
  const base = stage === "LEAGUE_STAGE" ? "Phase de ligue" : stage ?? "Champions League";
  return matchday ? `${base} - Journee ${matchday}` : base;
}

export function shouldUseShortName(name: string, shortName: string): boolean {
  return name.length > 18 && shortName.length > 0 && shortName.length < name.length;
}

export function teamDisplayName(team: ProgramTeam): string {
  return shouldUseShortName(team.name, team.shortName) ? team.shortName : team.name;
}

export function formatProgramDate(value: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: DEFAULT_TZ,
    ...options,
  }).format(new Date(value));
}

export function dayKey(value: string): string {
  return formatProgramDate(value, { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function dayLabel(value: string): string {
  return formatProgramDate(value, { weekday: "long", day: "2-digit", month: "long" });
}

export function timeLabel(value: string): string {
  return formatProgramDate(value, { hour: "2-digit", minute: "2-digit" });
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function teamFrom(raw: RawEventParticipant | undefined): ProgramTeam {
  const participant = one(raw?.participants);
  const logo = participant?.metadata?.logo_url;
  const name = participant?.name?.trim() || "Equipe a confirmer";
  return {
    id: participant?.id ?? null,
    name,
    shortName: participant?.short_name?.trim() || name,
    logoUrl: typeof logo === "string" && logo.length > 0 ? logo : null,
  };
}

function scoreFrom(result: Record<string, unknown> | null): { home: number; away: number } | null {
  const home = result?.home_score;
  const away = result?.away_score;
  if (typeof home === "number" && typeof away === "number") return { home, away };
  return null;
}

export function normalizeProgramEvent(
  event: RawProgramEvent,
  prediction?: { status: string; points: number | null } | null
): ProgramMatch {
  const home = event.event_participants.find((p) => p.role === "home");
  const away = event.event_participants.find((p) => p.role === "away");
  const season = one(event.seasons);
  const competition = one(season?.competitions);

  return {
    id: event.id,
    startsAt: event.starts_at,
    status: event.status,
    stage: event.stage,
    matchday: event.matchday,
    competitionName: competition?.name ?? "UEFA Champions League",
    seasonLabel: season?.label ?? null,
    home: teamFrom(home),
    away: teamFrom(away),
    score: scoreFrom(event.result),
    prediction,
  };
}

export function splitProgram(matches: ProgramMatch[], now: Date = new Date()) {
  const sorted = [...matches].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const today = dayKey(now.toISOString());
  const todayMatches = sorted.filter((m) => dayKey(m.startsAt) === today);
  const upcoming = sorted.filter((m) => m.status !== "finished" && new Date(m.startsAt) >= now);
  const finished = sorted
    .filter((m) => m.status === "finished")
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  return {
    hero: upcoming[0] ?? sorted.find((m) => m.status !== "finished") ?? sorted[0] ?? null,
    today: todayMatches,
    upcoming,
    finished,
  };
}

export function groupByDay(matches: ProgramMatch[]): { key: string; label: string; matches: ProgramMatch[] }[] {
  const groups = new Map<string, { key: string; label: string; matches: ProgramMatch[] }>();
  for (const match of matches) {
    const key = dayKey(match.startsAt);
    if (!groups.has(key)) groups.set(key, { key, label: dayLabel(match.startsAt), matches: [] });
    groups.get(key)!.matches.push(match);
  }
  return [...groups.values()];
}

export function meaningfulBadge(match: ProgramMatch, now: Date = new Date()): string | null {
  if (match.status === "live") return "En direct";
  if (match.prediction) return match.prediction.status === "settled" ? `${match.prediction.points ?? 0} pts` : "Prono fait";
  if (match.status === "finished") return "Termine";
  const start = new Date(match.startsAt);
  const diffMs = start.getTime() - now.getTime();
  if (diffMs < 0) return null;
  const startDay = dayKey(match.startsAt);
  const nowDay = dayKey(now.toISOString());
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = dayKey(tomorrow.toISOString());
  if (startDay === nowDay) return "Ce soir";
  if (startDay === tomorrowDay) return "Demain";
  return null;
}
