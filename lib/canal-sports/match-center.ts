import { DEFAULT_TZ } from "../utils.ts";
import { stageLabel, statusLabel, teamDisplayName, timeLabel } from "./programme.ts";

export type MatchCenterStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled" | string;

export type MatchCenterTeam = {
  id: string | null;
  name: string;
  shortName: string;
  country: string | null;
  logoUrl: string | null;
  standing: StandingSummary | null;
  recentForm: RecentFormEntry[];
  squad: SquadPlayer[];
  squadStatus: "available" | "partial" | "empty";
  seasonScorers: SeasonScorer[];
};

export type StandingSummary = {
  position: number;
  points: number | null;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  goalDifference: number | null;
  matchday: number | null;
  groupLabel: string | null;
};

export type RecentFormResult = "V" | "N" | "D";

export type RecentFormEntry = {
  eventId: string;
  startsAt: string;
  result: RecentFormResult;
  goalsFor: number;
  goalsAgainst: number;
};

export type SquadPlayer = {
  id: string;
  name: string;
  position: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
};

export type SeasonScorer = {
  id: string;
  playerName: string;
  goals: number;
};

export type MatchCenterPrediction = {
  id: string;
  payload: { home?: number; away?: number } | Record<string, unknown>;
  status: string;
  statusLabel: string;
  pointsAwarded: number | null;
  submittedAt: string | null;
  marketCode: string | null;
};

export type MatchCenterViewModel = {
  eventId: string;
  startsAt: string;
  dateLabel: string;
  timeLabel: string;
  status: MatchCenterStatus;
  statusLabel: string;
  stage: string | null;
  matchday: number | null;
  stageLabel: string;
  venue: string | null;
  competitionName: string;
  competitionSlug: string | null;
  seasonLabel: string | null;
  home: MatchCenterTeam;
  away: MatchCenterTeam;
  score: { home: number; away: number } | null;
  prediction: MatchCenterPrediction | null;
  canPredict: boolean;
  hasStandings: boolean;
  hasSquads: boolean;
  hasSeasonScorers: boolean;
  missingData: string[];
};

type SupabaseLike = {
  from: (table: string) => any;
};

type RawParticipant = {
  id?: string | null;
  name?: string | null;
  short_name?: string | null;
  country?: string | null;
  metadata?: Record<string, unknown> | null;
};

type RawPlayer = {
  id?: string | null;
  name?: string | null;
  position?: string | null;
  nationality?: string | null;
  date_of_birth?: string | null;
};

type RawEventParticipant = {
  role?: string | null;
  participants?: RawParticipant | RawParticipant[] | null;
};

export type RawMatchCenterEvent = {
  id: string;
  season_id: string;
  starts_at: string;
  venue: string | null;
  status: MatchCenterStatus;
  stage: string | null;
  matchday: number | null;
  leg: number | null;
  result: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  seasons?: {
    label?: string | null;
    competitions?: { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null;
  } | {
    label?: string | null;
    competitions?: { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null;
  }[] | null;
  event_participants: RawEventParticipant[];
};

export type RawRecentEvent = {
  id: string;
  starts_at: string;
  status: MatchCenterStatus;
  result: Record<string, unknown> | null;
  event_participants: RawEventParticipant[];
};

export type RawSquadMembership = {
  participant_id: string;
  players?: RawPlayer | RawPlayer[] | null;
};

export type RawStandingSnapshot = {
  participant_id: string;
  group_label: string | null;
  matchday: number | null;
  position: number;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  points: number | null;
  goal_difference: number | null;
  synced_at?: string | null;
};

export type RawScorer = {
  id: string;
  participant_id: string;
  goals: number;
  players?: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null;
};

export type RawPrediction = {
  id: string;
  payload: Record<string, unknown>;
  status: string;
  points_awarded: number | null;
  submitted_at: string | null;
  market_types?: { code?: string | null; name?: string | null } | { code?: string | null; name?: string | null }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function logoFrom(metadata: Record<string, unknown> | null | undefined): string | null {
  const logo = metadata?.logo_url;
  return typeof logo === "string" && logo.length > 0 ? logo : null;
}

function scoreFrom(result: Record<string, unknown> | null): { home: number; away: number } | null {
  const home = result?.home_score;
  const away = result?.away_score;
  return typeof home === "number" && typeof away === "number" ? { home, away } : null;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: DEFAULT_TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(value));
}

function predictionStatusLabel(prediction: RawPrediction, eventStatus: MatchCenterStatus): string {
  if (prediction.status === "settled") return `${prediction.points_awarded ?? 0} pts`;
  if (prediction.status === "void") return "Annule";
  if (eventStatus === "scheduled") return "Enregistre";
  return "Verrouille";
}

function teamFrom(raw: RawEventParticipant | undefined): Omit<MatchCenterTeam, "standing" | "recentForm" | "squad" | "squadStatus" | "seasonScorers"> {
  const participant = one(raw?.participants);
  const name = participant?.name?.trim() || "Equipe a confirmer";
  return {
    id: participant?.id ?? null,
    name,
    shortName: participant?.short_name?.trim() || name,
    country: participant?.country ?? null,
    logoUrl: logoFrom(participant?.metadata),
  };
}

function latestStandingFor(participantId: string | null, standings: RawStandingSnapshot[]): StandingSummary | null {
  if (!participantId) return null;
  const rows = standings
    .filter((row) => row.participant_id === participantId)
    .sort((a, b) => {
      const matchdayDelta = (b.matchday ?? -1) - (a.matchday ?? -1);
      if (matchdayDelta !== 0) return matchdayDelta;
      return new Date(b.synced_at ?? 0).getTime() - new Date(a.synced_at ?? 0).getTime();
    });
  const row = rows[0];
  if (!row) return null;
  return {
    position: row.position,
    points: row.points,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalDifference: row.goal_difference,
    matchday: row.matchday,
    groupLabel: row.group_label,
  };
}

function roleForParticipant(event: RawRecentEvent, participantId: string): string | null {
  const row = event.event_participants.find((participant) => one(participant.participants)?.id === participantId);
  return row?.role ?? null;
}

export function recentFormFor(participantId: string | null, events: RawRecentEvent[], currentStartsAt: string, limit = 5): RecentFormEntry[] {
  if (!participantId) return [];

  return events
    .filter((event) => event.status === "finished" && new Date(event.starts_at).getTime() < new Date(currentStartsAt).getTime())
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
    .map((event) => {
      const role = roleForParticipant(event, participantId);
      const score = scoreFrom(event.result);
      if (!role || !score) return null;

      const isHome = role === "home";
      const isAway = role === "away";
      if (!isHome && !isAway) return null;

      const goalsFor = isHome ? score.home : score.away;
      const goalsAgainst = isHome ? score.away : score.home;
      const result: RecentFormResult = goalsFor > goalsAgainst ? "V" : goalsFor === goalsAgainst ? "N" : "D";

      return {
        eventId: event.id,
        startsAt: event.starts_at,
        result,
        goalsFor,
        goalsAgainst,
      };
    })
    .filter((entry): entry is RecentFormEntry => !!entry)
    .slice(0, limit);
}

function squadFor(participantId: string | null, memberships: RawSquadMembership[]): SquadPlayer[] {
  if (!participantId) return [];
  return memberships
    .filter((membership) => membership.participant_id === participantId)
    .map((membership) => one(membership.players))
    .filter((player): player is RawPlayer & { id: string; name: string } => !!player?.id && !!player?.name)
    .map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position ?? null,
      nationality: player.nationality ?? null,
      dateOfBirth: player.date_of_birth ?? null,
    }))
    .sort((a, b) => (a.position ?? "").localeCompare(b.position ?? "") || a.name.localeCompare(b.name));
}

function squadStatus(players: SquadPlayer[]): MatchCenterTeam["squadStatus"] {
  if (players.length === 0) return "empty";
  return players.length >= 18 ? "available" : "partial";
}

function scorersFor(participantId: string | null, scorers: RawScorer[]): SeasonScorer[] {
  if (!participantId) return [];
  return scorers
    .filter((scorer) => scorer.participant_id === participantId)
    .map((scorer) => {
      const player = one(scorer.players);
      return player?.name ? { id: scorer.id, playerName: player.name, goals: scorer.goals } : null;
    })
    .filter((scorer): scorer is SeasonScorer => !!scorer)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 3);
}

export function normalizeMatchCenter(
  event: RawMatchCenterEvent,
  options: {
    squads?: RawSquadMembership[];
    standings?: RawStandingSnapshot[];
    recentEvents?: RawRecentEvent[];
    scorers?: RawScorer[];
    prediction?: RawPrediction | null;
  } = {}
): MatchCenterViewModel {
  const homeBase = teamFrom(event.event_participants.find((p) => p.role === "home"));
  const awayBase = teamFrom(event.event_participants.find((p) => p.role === "away"));
  const season = one(event.seasons);
  const competition = one(season?.competitions);
  const squads = options.squads ?? [];
  const standings = options.standings ?? [];
  const recentEvents = options.recentEvents ?? [];
  const scorers = options.scorers ?? [];
  const prediction = options.prediction ?? null;
  const homeSquad = squadFor(homeBase.id, squads);
  const awaySquad = squadFor(awayBase.id, squads);
  const homeRecentForm = recentFormFor(homeBase.id, recentEvents, event.starts_at);
  const awayRecentForm = recentFormFor(awayBase.id, recentEvents, event.starts_at);
  const homeScorers = scorersFor(homeBase.id, scorers);
  const awayScorers = scorersFor(awayBase.id, scorers);
  const normalizedPrediction = prediction
    ? {
        id: prediction.id,
        payload: prediction.payload,
        status: prediction.status,
        statusLabel: predictionStatusLabel(prediction, event.status),
        pointsAwarded: prediction.points_awarded,
        submittedAt: prediction.submitted_at,
        marketCode: one(prediction.market_types)?.code ?? null,
      }
    : null;

  const missingData = [];
  if (!event.venue) missingData.push("venue");
  if (homeSquad.length === 0 || awaySquad.length === 0) missingData.push("effectifs complets");
  if (!latestStandingFor(homeBase.id, standings) || !latestStandingFor(awayBase.id, standings)) missingData.push("classement");
  if (homeScorers.length === 0 && awayScorers.length === 0) missingData.push("buteurs de saison");

  return {
    eventId: event.id,
    startsAt: event.starts_at,
    dateLabel: dateLabel(event.starts_at),
    timeLabel: timeLabel(event.starts_at),
    status: event.status,
    statusLabel: statusLabel(event.status),
    stage: event.stage,
    matchday: event.matchday,
    stageLabel: stageLabel(event.stage, event.matchday),
    venue: event.venue,
    competitionName: competition?.name ?? "UEFA Champions League",
    competitionSlug: competition?.slug ?? null,
    seasonLabel: season?.label ?? null,
    home: {
      ...homeBase,
      standing: latestStandingFor(homeBase.id, standings),
      recentForm: homeRecentForm,
      squad: homeSquad,
      squadStatus: squadStatus(homeSquad),
      seasonScorers: homeScorers,
    },
    away: {
      ...awayBase,
      standing: latestStandingFor(awayBase.id, standings),
      recentForm: awayRecentForm,
      squad: awaySquad,
      squadStatus: squadStatus(awaySquad),
      seasonScorers: awayScorers,
    },
    score: scoreFrom(event.result),
    prediction: normalizedPrediction,
    canPredict: event.status === "scheduled" && new Date(event.starts_at).getTime() > Date.now(),
    hasStandings: !!latestStandingFor(homeBase.id, standings) && !!latestStandingFor(awayBase.id, standings),
    hasSquads: homeSquad.length > 0 || awaySquad.length > 0,
    hasSeasonScorers: homeScorers.length > 0 || awayScorers.length > 0,
    missingData,
  };
}

export type MatchCenterResult =
  | { ok: true; match: MatchCenterViewModel }
  | { ok: false; status: 404 | 500; message: string };

export async function getCanalSportsMatchCenter(
  eventId: string,
  targetUserId: string | null | undefined,
  supabase: SupabaseLike
): Promise<MatchCenterResult> {
  const { data: event, error } = await supabase
    .from("events")
    .select(
      `id, season_id, starts_at, venue, status, stage, matchday, leg, result, metadata,
       seasons(label, competitions(name, slug)),
       event_participants(role, participants(id, name, short_name, country, metadata))`
    )
    .eq("id", eventId)
    .maybeSingle();

  if (error) return { ok: false, status: 500, message: error.message };
  if (!event) return { ok: false, status: 404, message: "Match introuvable" };

  const rawEvent = event as RawMatchCenterEvent;
  const participantIds = rawEvent.event_participants
    .map((participant) => one(participant.participants)?.id)
    .filter((id): id is string => !!id);

  const [squadsResult, standingsResult, recentEventsResult, scorersResult, predictionResult] = await Promise.all([
    participantIds.length
      ? supabase
          .from("squad_memberships")
          .select("participant_id, players(id, name, position, nationality, date_of_birth)")
          .eq("season_id", rawEvent.season_id)
          .eq("is_current", true)
          .in("participant_id", participantIds)
      : Promise.resolve({ data: [], error: null }),
    participantIds.length
      ? supabase
          .from("standings_snapshots")
          .select("participant_id, group_label, matchday, position, played, won, drawn, lost, points, goal_difference, synced_at")
          .eq("season_id", rawEvent.season_id)
          .in("participant_id", participantIds)
      : Promise.resolve({ data: [], error: null }),
    participantIds.length
      ? supabase
          .from("events")
          .select("id, starts_at, status, result, event_participants(role, participants(id))")
          .eq("season_id", rawEvent.season_id)
          .eq("status", "finished")
          .lt("starts_at", rawEvent.starts_at)
          .order("starts_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    participantIds.length
      ? supabase
          .from("scorers")
          .select("id, participant_id, goals, players(id, name)")
          .eq("season_id", rawEvent.season_id)
          .in("participant_id", participantIds)
      : Promise.resolve({ data: [], error: null }),
    targetUserId ? getPredictionForUser(supabase, eventId, targetUserId) : Promise.resolve({ data: null, error: null }),
  ]);

  const firstError = squadsResult.error ?? standingsResult.error ?? recentEventsResult.error ?? scorersResult.error ?? predictionResult.error;
  if (firstError) return { ok: false, status: 500, message: firstError.message };

  return {
    ok: true,
    match: normalizeMatchCenter(rawEvent, {
      squads: (squadsResult.data ?? []) as RawSquadMembership[],
      standings: (standingsResult.data ?? []) as RawStandingSnapshot[],
      recentEvents: (recentEventsResult.data ?? []) as RawRecentEvent[],
      scorers: (scorersResult.data ?? []) as RawScorer[],
      prediction: predictionResult.data as RawPrediction | null,
    }),
  };
}

async function getPredictionForUser(supabase: SupabaseLike, eventId: string, targetAuthId: string) {
  const { data: me, error: userError } = await supabase.from("users").select("id").eq("auth_id", targetAuthId).maybeSingle();
  if (userError || !me) return { data: null, error: userError ?? null };

  return supabase
    .from("predictions")
    .select("id, payload, status, points_awarded, submitted_at, market_types(code, name)")
    .eq("user_id", me.id)
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export { teamDisplayName };
