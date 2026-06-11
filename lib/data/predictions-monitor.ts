import { createAdminClient } from "@/lib/supabase/admin";
import { calculatePoints } from "@/lib/scoring";
import type { Match } from "@/lib/supabase/types";

export type PredictionOutcome = "exact" | "correct_result" | "correct_diff" | "wrong" | "pending";

export interface PredictionMonitorMatchOption {
  id: string;
  team_a: string;
  team_b: string;
  flag_a: string | null;
  flag_b: string | null;
  starts_at: string;
  status: Match["status"];
  score_a: number | null;
  score_b: number | null;
}

export interface PredictionMonitorUserRow {
  user_id: string;
  display_name: string;
  email: string;
  login: string;
  service_id: string | null;
  service_name: string | null;
  team_id: string | null;
  team_name: string | null;
  profile_completed: boolean;
  has_team: boolean;
  status_label: "OK" | "sans équipe" | "profil incomplet";
  predicted_score_a: number | null;
  predicted_score_b: number | null;
  prediction_result: "A" | "DRAW" | "B" | null;
  prediction_created_at: string | null;
  prediction_updated_at: string | null;
  points: number | null;
  outcome: PredictionOutcome;
}

export interface PredictionMonitorMissingUserRow {
  user_id: string;
  display_name: string;
  email: string;
  login: string;
  service_id: string | null;
  service_name: string | null;
  team_id: string | null;
  team_name: string | null;
  profile_completed: boolean;
  status_label: "OK" | "sans équipe" | "profil incomplet";
}

export interface ParticipationBucket {
  id: string;
  name: string;
  total: number;
  predicted: number;
  participation_rate: number;
}

export interface PredictionMonitorSummary {
  predicted_count: number;
  eligible_count: number;
  missing_count: number;
  participation_rate: number;
  started: boolean;
  finished: boolean;
  live: boolean;
  exact_count: number;
  score_distribution: { a: number; draw: number; b: number };
  score_distribution_counts: { a: number; draw: number; b: number };
  distinct_scores: number;
  most_played_score: {
    predicted_score_a: number;
    predicted_score_b: number;
    count: number;
  } | null;
  team_most_active: ParticipationBucket | null;
  service_most_active: ParticipationBucket | null;
  team_participation: ParticipationBucket[];
  service_participation: ParticipationBucket[];
}

export interface PredictionMonitorPayload {
  match: PredictionMonitorMatchOption;
  matches: PredictionMonitorMatchOption[];
  defaultMatchId: string;
  nextUpcomingMatchId: string | null;
  todayMatchId: string | null;
  previousMatchId: string | null;
  nextMatchId: string | null;
  predictedUsers: PredictionMonitorUserRow[];
  missingUsers: PredictionMonitorMissingUserRow[];
  participationRate: number;
  summaryStats: PredictionMonitorSummary;
}

function resultFromScore(a: number | null, b: number | null): "A" | "DRAW" | "B" | null {
  if (a == null || b == null) return null;
  if (a > b) return "A";
  if (b > a) return "B";
  return "DRAW";
}

function liveOutcome(pa: number, pb: number, aa: number | null, ab: number | null): PredictionOutcome {
  if (aa == null || ab == null) return "pending";
  if (pa === aa && pb === ab) return "exact";
  const res = (x: number, y: number) => (x > y ? "A" : y > x ? "B" : "DRAW");
  if (res(pa, pb) === res(aa, ab)) return "correct_result";
  if (pa - pb === aa - ab) return "correct_diff";
  return "wrong";
}

function fmtLogin(email: string): string {
  return email.split("@")[0] || email;
}

function scoreKey(a: number | null, b: number | null): string {
  return `${a ?? "?"}-${b ?? "?"}`;
}

function participationRate(predicted: number, total: number): number {
  if (!total) return 0;
  return Math.round((predicted / total) * 1000) / 10;
}

function byCountThenName(a: ParticipationBucket, b: ParticipationBucket): number {
  return b.predicted - a.predicted || b.participation_rate - a.participation_rate || a.name.localeCompare(b.name, "fr");
}

export async function getMatchPredictionMonitor(matchId?: string | null): Promise<PredictionMonitorPayload | null> {
  const admin = createAdminClient();

  const [{ data: matchRows }, { data: allowlistRows }, { data: profileRows }, { data: predictionsRows }] = await Promise.all([
    admin
      .from("matches")
      .select("id, team_a, team_b, flag_a, flag_b, starts_at, status, score_a, score_b")
      .order("starts_at", { ascending: true }),
    admin.from("allowlist_users").select("email, role, is_active"),
    admin
      .from("users")
      .select("id, email, display_name, name, team_id, service_id, profile_completed, team:teams!team_id(id, name), service:services!service_id(id, name)"),
    matchId
      ? admin
          .from("predictions")
          .select("user_id, prediction_result, predicted_score_a, predicted_score_b, created_at, updated_at")
          .eq("match_id", matchId)
      : Promise.resolve({ data: [] as Array<{
          user_id: string;
          prediction_result: "A" | "DRAW" | "B";
          predicted_score_a: number | null;
          predicted_score_b: number | null;
          created_at: string;
          updated_at: string | null;
        }> }),
  ]);

  const matches = (matchRows ?? []) as PredictionMonitorMatchOption[];
  if (!matches.length) return null;

  const now = new Date();
  const validMatchId = matchId && matches.some((m) => m.id === matchId) ? matchId : null;
  const defaultMatch =
    (matches.find((m) => m.status !== "finished" && new Date(m.starts_at) >= now) ?? matches[0]) as PredictionMonitorMatchOption;
  const selectedMatch = (validMatchId ? matches.find((m) => m.id === validMatchId) : null) ?? defaultMatch;
  const selectedIndex = Math.max(0, matches.findIndex((m) => m.id === selectedMatch.id));

  const predictions = (predictionsRows ?? []) as Array<{
    user_id: string;
    prediction_result: "A" | "DRAW" | "B";
    predicted_score_a: number | null;
    predicted_score_b: number | null;
    created_at: string;
    updated_at: string | null;
  }>;
  const predictedUserIds = [...new Set(predictions.map((p) => p.user_id))];

  const [usersResp, teamsResp, servicesResp] = await Promise.all([
    predictedUserIds.length
      ? admin
          .from("users")
          .select("id, email, display_name, name, team_id, service_id, profile_completed")
          .in("id", predictedUserIds)
      : Promise.resolve({ data: [] as Array<{
          id: string;
          email: string;
          display_name: string | null;
          name: string | null;
          team_id: string | null;
          service_id: string | null;
          profile_completed: boolean | null;
        }> }),
    admin.from("teams").select("id, name"),
    admin.from("services").select("id, name"),
  ]);

  const userRows = (profileRows ?? []) as Array<{
    id: string;
    email: string;
    display_name: string | null;
    name: string | null;
    team_id: string | null;
    service_id: string | null;
    profile_completed: boolean | null;
  }>;
  const usersByEmail = new Map(userRows.map((u) => [u.email.toLowerCase(), u]));
  const usersById = new Map((usersResp.data ?? []).map((u) => [u.id, u]));

  const teamNameById = new Map((teamsResp.data ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
  const serviceNameById = new Map((servicesResp.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
  const adminRoleEmails = new Set(
    (allowlistRows ?? [])
      .filter((r: { role: string; is_active: boolean }) => r.is_active && (r.role === "admin" || r.role === "super_admin"))
      .map((r: { email: string }) => r.email.toLowerCase())
  );

  const activeAllowlist = (allowlistRows ?? [])
    .filter((r: { role: string; is_active: boolean }) => r.is_active && r.role !== "admin" && r.role !== "super_admin")
    .map((r: { email: string; role: string; is_active: boolean }) => r.email.toLowerCase());

  const eligible = activeAllowlist
    .map((email) => usersByEmail.get(email))
    .filter((u): u is NonNullable<typeof u> => !!u && !adminRoleEmails.has(u.email.toLowerCase()));

  const predictedSet = new Set(predictedUserIds);
  const selectedMatchResult = matches.find((m) => m.id === selectedMatch.id) ?? selectedMatch;
  const started =
    selectedMatchResult.status === "live" ||
    selectedMatchResult.status === "halftime" ||
    selectedMatchResult.status === "finished" ||
    new Date(selectedMatchResult.starts_at) <= now;
  const finished = selectedMatchResult.status === "finished";
  const live = selectedMatchResult.status === "live" || selectedMatchResult.status === "halftime";
  const hasScore = (started || finished || live) && selectedMatchResult.score_a != null && selectedMatchResult.score_b != null;

  const predictedUsers = (predictions
    .map((p) => {
      const u = usersById.get(p.user_id);
      if (!u) return null;
      if (adminRoleEmails.has(u.email.toLowerCase())) return null;
      const login = fmtLogin(u.email);
      const teamName = u.team_id ? teamNameById.get(u.team_id) ?? null : null;
      const serviceName = u.service_id ? serviceNameById.get(u.service_id) ?? null : null;
      const profileCompleted = !!u.profile_completed;
      const hasTeam = !!u.team_id;
      const status_label = profileCompleted ? (hasTeam ? "OK" : "sans équipe") : "profil incomplet";
      const predicted_score_a = p.predicted_score_a;
      const predicted_score_b = p.predicted_score_b;
      const outcome = hasScore
        ? liveOutcome(predicted_score_a ?? 0, predicted_score_b ?? 0, selectedMatchResult.score_a, selectedMatchResult.score_b)
        : "pending";
      const points =
        finished && predicted_score_a != null && predicted_score_b != null
          ? calculatePoints(
              {
                id: selectedMatchResult.id,
                competition: "",
                team_a: selectedMatchResult.team_a,
                team_b: selectedMatchResult.team_b,
                flag_a: selectedMatchResult.flag_a ?? undefined,
                flag_b: selectedMatchResult.flag_b ?? undefined,
                starts_at: selectedMatchResult.starts_at,
                channel: "",
                status: "finished",
                score_a: selectedMatchResult.score_a ?? undefined,
                score_b: selectedMatchResult.score_b ?? undefined,
              } as Match,
              predicted_score_a,
              predicted_score_b
            )
          : null;
      return {
        user_id: u.id,
        display_name: u.display_name ?? u.name ?? u.email.split("@")[0] ?? "—",
        email: u.email,
        login,
        service_id: u.service_id ?? null,
        service_name: serviceName,
        team_id: u.team_id ?? null,
        team_name: teamName,
        profile_completed: profileCompleted,
        has_team: hasTeam,
        status_label,
        predicted_score_a,
        predicted_score_b,
        prediction_result: p.prediction_result,
        prediction_created_at: p.created_at,
        prediction_updated_at: p.updated_at ?? p.created_at,
        points,
        outcome,
      } satisfies PredictionMonitorUserRow;
    })
    .filter((row) => !!row) as PredictionMonitorUserRow[]).sort((a, b) => {
      const ap = a.points ?? -1;
      const bp = b.points ?? -1;
      return bp - ap || a.display_name.localeCompare(b.display_name, "fr");
    });

  const missingUsers = eligible
    .filter((u) => !predictedSet.has(u.id))
    .map((u) => {
      const login = fmtLogin(u.email);
      const teamName = u.team_id ? teamNameById.get(u.team_id) ?? null : null;
      const serviceName = u.service_id ? serviceNameById.get(u.service_id) ?? null : null;
      const profileCompleted = !!u.profile_completed;
      const hasTeam = !!u.team_id;
      const status_label = profileCompleted ? (hasTeam ? "OK" : "sans équipe") : "profil incomplet";
      return {
        user_id: u.id,
        display_name: u.display_name ?? u.name ?? u.email.split("@")[0] ?? "—",
        email: u.email,
        login,
        service_id: u.service_id ?? null,
        service_name: serviceName,
        team_id: u.team_id ?? null,
        team_name: teamName,
        profile_completed: profileCompleted,
        status_label,
      } satisfies PredictionMonitorMissingUserRow;
    })
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "fr"));

  const scoreDistribution = predictedUsers.reduce(
    (acc, row) => {
      const result = resultFromScore(row.predicted_score_a, row.predicted_score_b);
      if (result === "A") acc.a++;
      else if (result === "DRAW") acc.draw++;
      else if (result === "B") acc.b++;
      return acc;
    },
    { a: 0, draw: 0, b: 0 }
  );
  const totalPredicted = Math.max(1, predictedUsers.length);

  const scoreCounts = new Map<string, { a: number; b: number; count: number }>();
  for (const row of predictedUsers) {
    if (row.predicted_score_a == null || row.predicted_score_b == null) continue;
    const key = scoreKey(row.predicted_score_a, row.predicted_score_b);
    const current = scoreCounts.get(key) ?? { a: row.predicted_score_a, b: row.predicted_score_b, count: 0 };
    current.count += 1;
    scoreCounts.set(key, current);
  }
  const mostPlayedScore = [...scoreCounts.values()].sort((x, y) => y.count - x.count || x.a - y.a || x.b - y.b)[0] ?? null;

  const teamStats = new Map<string, { id: string; name: string; total: number; predicted: number }>();
  const serviceStats = new Map<string, { id: string; name: string; total: number; predicted: number }>();
  for (const u of eligible) {
    if (u.team_id) {
      const teamName = teamNameById.get(u.team_id) ?? "—";
      const current = teamStats.get(u.team_id) ?? { id: u.team_id, name: teamName, total: 0, predicted: 0 };
      current.total += 1;
      if (predictedSet.has(u.id)) current.predicted += 1;
      teamStats.set(u.team_id, current);
    }
    if (u.service_id) {
      const serviceName = serviceNameById.get(u.service_id) ?? "—";
      const current = serviceStats.get(u.service_id) ?? { id: u.service_id, name: serviceName, total: 0, predicted: 0 };
      current.total += 1;
      if (predictedSet.has(u.id)) current.predicted += 1;
      serviceStats.set(u.service_id, current);
    }
  }

  const teamParticipation = [...teamStats.values()]
    .map((bucket) => ({
      ...bucket,
      participation_rate: participationRate(bucket.predicted, bucket.total),
    }))
    .sort(byCountThenName);
  const serviceParticipation = [...serviceStats.values()]
    .map((bucket) => ({
      ...bucket,
      participation_rate: participationRate(bucket.predicted, bucket.total),
    }))
    .sort(byCountThenName);

  const selectedTeam = teamParticipation[0] ?? null;
  const selectedService = serviceParticipation[0] ?? null;

  const summaryStats: PredictionMonitorSummary = {
    predicted_count: predictedUsers.length,
    eligible_count: eligible.length,
    missing_count: missingUsers.length,
    participation_rate: participationRate(predictedUsers.length, eligible.length),
    started,
    finished,
    live,
    exact_count: finished && hasScore ? predictedUsers.filter((p) => p.outcome === "exact").length : 0,
    score_distribution: {
      a: Math.round((scoreDistribution.a / totalPredicted) * 100),
      draw: Math.round((scoreDistribution.draw / totalPredicted) * 100),
      b: Math.round((scoreDistribution.b / totalPredicted) * 100),
    },
    score_distribution_counts: scoreDistribution,
    distinct_scores: scoreCounts.size,
    most_played_score: mostPlayedScore
      ? {
          predicted_score_a: mostPlayedScore.a,
          predicted_score_b: mostPlayedScore.b,
          count: mostPlayedScore.count,
        }
      : null,
    team_most_active: selectedTeam,
    service_most_active: selectedService,
    team_participation: teamParticipation,
    service_participation: serviceParticipation,
  };

  const todayKey = new Intl.DateTimeFormat("fr-CA", { timeZone: "Pacific/Noumea", dateStyle: "short" }).format(now);
  const todayMatch = matches.find(
    (m) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Pacific/Noumea", dateStyle: "short" }).format(new Date(m.starts_at)) === todayKey
  );
  const upcoming = matches.find((m) => m.status !== "finished" && new Date(m.starts_at) > now) ?? null;

  return {
    match: selectedMatch,
    matches,
    defaultMatchId: defaultMatch.id,
    nextUpcomingMatchId: upcoming?.id ?? null,
    todayMatchId: todayMatch?.id ?? null,
    previousMatchId: matches[selectedIndex - 1]?.id ?? null,
    nextMatchId: matches[selectedIndex + 1]?.id ?? null,
    predictedUsers,
    missingUsers,
    participationRate: summaryStats.participation_rate,
    summaryStats,
  };
}
