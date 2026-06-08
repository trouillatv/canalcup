// ─────────────────────────────────────────────────────────────────────────────
//  DASHBOARD ÉQUIPE (/teams/[id]) — fiche sportive du binôme (page de JEU).
//  Pas de données RH (ni email, ni dernière connexion, ni logs). Réutilise
//  computeTeamScores (ranks + ScoreBreakdown via getLeaderboard) et
//  getTeamPredictionHeatmap. Stats pronos/quiz/baby/anim agrégées par équipe.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@/lib/supabase/server";
import { computeTeamScores, getLeaderboard } from "@/lib/data/teams";
import { getAdminEmails } from "@/lib/data/roles";
import { getPredictionOutcome } from "@/lib/scoring";
import { TEAM_MAX_MEMBERS } from "@/lib/teams/config";
import type { LeaderboardRow } from "@/lib/supabase/types";

export interface TeamDashboard {
  team: {
    id: string;
    name: string;
    slogan: string | null;
    initials: string;
    captainName: string | null;
    inviteCode: string | null;
    createdByUserId: string | null;
    createdAt: string | null;
    memberCount: number;
    maxMembers: number;
    members: { id: string; name: string; isCaptain: boolean; isAdmin: boolean }[];
  };
  ranks: { global: number | null; pronos: number | null; quiz: number | null; babyfoot: number | null; animations: number | null; outOf: number };
  lbRow: LeaderboardRow | null;
  predictionStats: {
    count: number;
    finishedCount: number;
    exactPct: number;
    correctPct: number;
    bestStreak: number;
    bestStreakPlayer: string | null;
    mostReliable: { name: string; pct: number } | null;
    mostAudacious: { name: string; avgGoals: number } | null;
  };
  quizStats: { count: number; correctPct: number; fast: number; bestPlayer: { name: string; correct: number } | null };
  babyfootStats: { played: number; wins: number; losses: number; ratioPct: number; last: string | null; next: string | null };
  animationStats: { participations: number; points: number; lastValidated: string | null };
  forces: { label: string };
  recentActivity: { emoji: string; label: string; created_at: string }[];
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}
const rankBy = (map: Map<string, number>, id: string): number | null => {
  const v = map.get(id);
  if (v == null) return null;
  let rank = 1;
  for (const [oid, ov] of map) if (oid !== id && ov > v) rank++;
  return rank;
};

export async function getTeamDashboard(teamId: string): Promise<TeamDashboard | null> {
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, slogan, invite_code, created_by_user_id, created_at")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return null;

  const [
    { data: membershipsRaw },
    { data: allTeams },
    { data: matches },
    { data: babyMatches },
    { data: challenges },
    leaderboard,
    adminEmails,
  ] = await Promise.all([
    // Source de vérité multi-équipes : team_memberships (pas users.team_id).
    supabase.from("team_memberships")
      .select("role, user:users(id, display_name, name, email)")
      .eq("team_id", teamId),
    supabase.from("teams").select("id"),
    supabase.from("matches").select("id, status, score_a, score_b, starts_at, team_a, team_b"),
    supabase.from("babyfoot_matches").select("team_a_id, team_b_id, score_a, score_b, status, starts_at").or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`),
    supabase.from("challenges").select("id, title"),
    getLeaderboard(),
    getAdminEmails(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = ((membershipsRaw ?? []) as any[]).map((row) => ({
    id: row.user?.id as string,
    display_name: row.user?.display_name as string | null,
    name: row.user?.name as string | null,
    email: row.user?.email as string | null,
    team_role: row.role as string | null,
  })).filter((m) => !!m.id);
  const memberIds = members.map((m) => m.id);
  const nameOf = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m?.display_name ?? m?.name ?? "Joueur";
  };

  // Pronos / quiz / animations des membres.
  const [{ data: preds }, { data: quizzes }, { data: entries }, { data: parts }, { data: events }] = await Promise.all([
    memberIds.length ? supabase.from("predictions").select("id, user_id, match_id, predicted_score_a, predicted_score_b, points_awarded, created_at").in("user_id", memberIds) : Promise.resolve({ data: [] }),
    memberIds.length ? supabase.from("quiz_answers").select("user_id, is_correct, response_time_ms, points_awarded, created_at").in("user_id", memberIds) : Promise.resolve({ data: [] }),
    memberIds.length ? supabase.from("challenge_entries").select("id, user_id, challenge_id, points_awarded, status, created_at").in("user_id", memberIds) : Promise.resolve({ data: [] }),
    memberIds.length ? supabase.from("challenge_entry_participants").select("entry_id, user_id, created_at").in("user_id", memberIds) : Promise.resolve({ data: [] }),
    supabase.from("score_events").select("category, raw_points").eq("team_id", teamId),
  ]);

  // ─── Rangs par pilier (sur toutes les équipes) ──────────────────────────────
  const agg = await computeTeamScores(supabase, (allTeams ?? []).map((t: { id: string }) => t.id));
  const totalMap = new Map<string, number>(), pronosMap = new Map<string, number>(), quizMap = new Map<string, number>(), babyMap = new Map<string, number>(), animMap = new Map<string, number>();
  for (const [id, b] of agg) {
    totalMap.set(id, b.total);
    pronosMap.set(id, b.predRaw + b.bonusRaw);
    quizMap.set(id, b.quizRaw);
    babyMap.set(id, b.babyRaw);
    animMap.set(id, b.animRaw);
  }
  const ranks = {
    global: rankBy(totalMap, teamId),
    pronos: rankBy(pronosMap, teamId),
    quiz: rankBy(quizMap, teamId),
    babyfoot: rankBy(babyMap, teamId),
    animations: rankBy(animMap, teamId),
    outOf: agg.size,
  };
  const lbRow = leaderboard.find((r) => r.team.id === teamId) ?? null;

  // ─── Stats pronostics équipe ────────────────────────────────────────────────
  type M = { id: string; status: string; score_a: number | null; score_b: number | null; starts_at: string; team_a: string; team_b: string };
  const matchById = new Map((matches ?? []).map((m: M) => [m.id, m]));
  type P = { id: string; user_id: string; match_id: string | null; predicted_score_a: number | null; predicted_score_b: number | null; points_awarded: number | null; created_at: string };
  const predList = (preds ?? []) as P[];

  let exact = 0, correct = 0, missed = 0;
  for (const p of predList) {
    const o = getPredictionOutcome(p, p.match_id ? matchById.get(p.match_id) ?? null : null);
    if (o === "exact") exact++; else if (o === "correct_result" || o === "correct_diff") correct++; else if (o === "wrong") missed++;
  }
  const finishedCount = exact + correct + missed;
  const pPct = (n: number) => (finishedCount > 0 ? Math.round((n / finishedCount) * 100) : 0);

  // Par membre : fiabilité (exact+bon / finis), audace (moy. buts prédits), meilleure série.
  let mostReliable: TeamDashboard["predictionStats"]["mostReliable"] = null;
  let mostAudacious: TeamDashboard["predictionStats"]["mostAudacious"] = null;
  let bestStreak = 0, bestStreakPlayer: string | null = null;
  for (const mem of members) {
    const mine = predList.filter((p) => p.user_id === mem.id);
    if (!mine.length) continue;
    // audace : moyenne de buts prédits
    const avgGoals = mine.reduce((s, p) => s + (p.predicted_score_a ?? 0) + (p.predicted_score_b ?? 0), 0) / mine.length;
    if (!mostAudacious || avgGoals > mostAudacious.avgGoals) mostAudacious = { name: nameOf(mem.id), avgGoals: Math.round(avgGoals * 10) / 10 };
    // fiabilité sur matchs finis
    const fin = mine.map((p) => getPredictionOutcome(p, p.match_id ? matchById.get(p.match_id) ?? null : null)).filter((o) => o !== "pending");
    if (fin.length) {
      const good = fin.filter((o) => o === "exact" || o === "correct_result" || o === "correct_diff").length;
      const pct = Math.round((good / fin.length) * 100);
      if (!mostReliable || pct > mostReliable.pct) mostReliable = { name: nameOf(mem.id), pct };
    }
    // meilleure série de scores exacts (ordre chronologique)
    const chrono = mine
      .filter((p) => p.match_id && matchById.get(p.match_id)?.status === "finished")
      .sort((a, b) => (matchById.get(a.match_id!)!.starts_at < matchById.get(b.match_id!)!.starts_at ? -1 : 1));
    let run = 0, best = 0;
    for (const p of chrono) {
      if (getPredictionOutcome(p, matchById.get(p.match_id!) ?? null) === "exact") { run++; best = Math.max(best, run); } else run = 0;
    }
    if (best > bestStreak) { bestStreak = best; bestStreakPlayer = nameOf(mem.id); }
  }

  // ─── Stats quiz équipe ──────────────────────────────────────────────────────
  type Q = { user_id: string; is_correct: boolean; response_time_ms: number | null; points_awarded: number | null; created_at: string };
  const quizList = (quizzes ?? []) as Q[];
  const quizCorrect = quizList.filter((q) => q.is_correct).length;
  const quizFast = quizList.filter((q) => (q.response_time_ms ?? 99999) < 5000).length;
  let bestQuizPlayer: TeamDashboard["quizStats"]["bestPlayer"] = null;
  for (const mem of members) {
    const c = quizList.filter((q) => q.user_id === mem.id && q.is_correct).length;
    if (c > 0 && (!bestQuizPlayer || c > bestQuizPlayer.correct)) bestQuizPlayer = { name: nameOf(mem.id), correct: c };
  }

  // ─── Babyfoot ───────────────────────────────────────────────────────────────
  type BM = { team_a_id: string; team_b_id: string; score_a: number | null; score_b: number | null; status: string; starts_at: string | null };
  const bms = (babyMatches ?? []) as BM[];
  const finishedBm = bms.filter((m) => m.status === "finished");
  let wins = 0, losses = 0;
  for (const m of finishedBm) {
    const isA = m.team_a_id === teamId;
    const my = isA ? (m.score_a ?? 0) : (m.score_b ?? 0);
    const opp = isA ? (m.score_b ?? 0) : (m.score_a ?? 0);
    if (my > opp) wins++; else if (my < opp) losses++;
  }
  const last = [...finishedBm].sort((a, b) => ((b.starts_at ?? "") > (a.starts_at ?? "") ? 1 : -1))[0]?.starts_at ?? null;
  const next = bms.filter((m) => m.status !== "finished" && m.starts_at).sort((a, b) => ((a.starts_at ?? "") < (b.starts_at ?? "") ? -1 : 1))[0]?.starts_at ?? null;

  // ─── Animations ─────────────────────────────────────────────────────────────
  type Entry = { id: string; user_id: string; challenge_id: string | null; points_awarded: number | null; status: string | null; created_at: string };
  const entryList = (entries ?? []) as Entry[];
  const partList = (parts ?? []) as { entry_id: string; created_at: string }[];
  const animParticipations = new Set<string>([...entryList.map((e) => e.id), ...partList.map((p) => p.entry_id)]).size;
  const animPoints = ((events ?? []) as { category: string | null; raw_points: number | null }[])
    .filter((e) => e.category === "challenges" || e.category === "social" || e.category === "bonus")
    .reduce((s, e) => s + (e.raw_points ?? 0), 0);
  const cTitle = new Map((challenges ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
  const lastValidatedEntry = [...entryList].filter((e) => e.status === "approved").sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0];
  const lastValidated = lastValidatedEntry ? (lastValidatedEntry.challenge_id ? cTitle.get(lastValidatedEntry.challenge_id) ?? "Animation" : "Animation") : null;

  // ─── Profil de l'équipe (pilier le mieux classé) ────────────────────────────
  const forceCandidates: { label: string; rank: number | null }[] = [
    { label: "🎯 Forte en pronostics", rank: ranks.pronos },
    { label: "🧠 Forte en quiz", rank: ranks.quiz },
    { label: "⚽ Forte en babyfoot", rank: ranks.babyfoot },
    { label: "🎉 Forte en animations", rank: ranks.animations },
  ].filter((c) => c.rank != null);
  forceCandidates.sort((a, b) => (a.rank! - b.rank!));
  const forces = { label: forceCandidates[0]?.label ?? "🎉 Équipe d'ambiance" };

  // ─── Activité récente (10) ──────────────────────────────────────────────────
  const activity: TeamDashboard["recentActivity"] = [];
  for (const p of predList) { const m = p.match_id ? matchById.get(p.match_id) : undefined; activity.push({ emoji: "🎯", label: `${nameOf(p.user_id)} — prono ${m ? `${m.team_a}–${m.team_b}` : ""}`.trim(), created_at: p.created_at }); }
  for (const q of quizList) activity.push({ emoji: "🧠", label: `${nameOf(q.user_id)} — quiz`, created_at: q.created_at });
  for (const e of entryList) activity.push({ emoji: "🎉", label: `${nameOf(e.user_id)} — ${e.challenge_id ? cTitle.get(e.challenge_id) ?? "animation" : "animation"}`, created_at: e.created_at });
  for (const m of finishedBm) if (m.starts_at) activity.push({ emoji: "⚽", label: "Match babyfoot", created_at: m.starts_at });
  activity.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

  const captain = members.find((m) => m.team_role === "captain");
  return {
    team: {
      id: team.id,
      name: team.name,
      slogan: team.slogan ?? null,
      initials: initialsOf(team.name),
      captainName: captain ? (captain.display_name ?? captain.name ?? null) : null,
      inviteCode: team.invite_code ?? null,
      createdByUserId: team.created_by_user_id ?? null,
      createdAt: team.created_at ?? null,
      memberCount: members.length,
      maxMembers: TEAM_MAX_MEMBERS,
      members: members.map((m) => ({
        id: m.id,
        name: m.display_name ?? m.name ?? "Joueur",
        isCaptain: m.team_role === "captain",
        isAdmin: adminEmails.has((m.email ?? "").toLowerCase()),
      })),
    },
    ranks,
    lbRow,
    predictionStats: {
      count: predList.length, finishedCount,
      exactPct: pPct(exact), correctPct: pPct(correct),
      bestStreak, bestStreakPlayer, mostReliable, mostAudacious,
    },
    quizStats: {
      count: quizList.length,
      correctPct: quizList.length > 0 ? Math.round((quizCorrect / quizList.length) * 100) : 0,
      fast: quizFast, bestPlayer: bestQuizPlayer,
    },
    babyfootStats: {
      played: finishedBm.length, wins, losses,
      ratioPct: finishedBm.length > 0 ? Math.round((wins / finishedBm.length) * 100) : 0,
      last, next,
    },
    animationStats: { participations: animParticipations, points: animPoints, lastValidated },
    forces,
    recentActivity: activity.slice(0, 10),
  };
}
