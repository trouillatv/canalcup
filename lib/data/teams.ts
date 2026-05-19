import { createClient } from "@/lib/supabase/server";
import { MOCK_TEAMS, MOCK_LEADERBOARD } from "@/lib/mock-data";
import type { Team, LeaderboardRow } from "@/lib/supabase/types";

// ─────────────────────────────────────────────────────────────────────────────
//  SOURCE UNIQUE DE VÉRITÉ DU SCORE ÉQUIPE
//
//  teams.total_points (colonne DB) = dette : valeurs de seed démo figées,
//  jamais mises à jour. Elle n'est PLUS lue pour l'affichage ni le tri.
//  Tout score équipe affiché (Classement, /teams, fiche équipe, brief) est
//  recalculé ici depuis les tables de scoring granulaires, via la MÊME
//  fonction → mêmes points partout, toujours.
//
//  score_events (scoring des animations) : volontairement PAS encore sommé
//  ici tant que la pondération globale n'est pas validée (éviter que les
//  pronos écrasent tout / double comptage). Point d'extension balisé plus
//  bas (TODO score_events) — branchement futur = 2 lignes.
// ─────────────────────────────────────────────────────────────────────────────

interface TeamBreakdown {
  pp: number; // pronos
  bonus: number; // bonus_predictions (ex. perfect streak)
  qp: number; // quiz
  bp: number; // babyfoot (10 pts / victoire)
  vp: number; // votes reçus
  total: number;
}

const ZERO: TeamBreakdown = { pp: 0, bonus: 0, qp: 0, bp: 0, vp: 0, total: 0 };

// Accepte aussi bien le client serveur (cookies) que le client admin
// (service role, ex. crons) — mêmes points calculés quel que soit l'appelant.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

/**
 * Agrégation des points par équipe depuis les tables de scoring granulaires.
 * UNIQUE implémentation — réutilisée par getLeaderboard / getTeams /
 * getTeamById / getTeamScores et le cron morning-brief.
 */
export async function computeTeamScores(
  supabase: DbClient,
  teamIds: string[]
): Promise<Map<string, TeamBreakdown>> {
  const [
    { data: predPoints },
    { data: bonusPoints },
    { data: quizPoints },
    { data: babyPoints },
    { data: votePoints },
  ] = await Promise.all([
    supabase.from("predictions").select("team_id, points_awarded"),
    supabase.from("bonus_predictions").select("team_id, points_awarded"),
    supabase.from("quiz_answers").select("team_id, points_awarded"),
    supabase.from("babyfoot_matches").select("team_a_id, team_b_id, score_a, score_b, status"),
    supabase.from("votes").select("target_team_id, value"),
  ]);
  // TODO(score_events) — quand la pondération globale sera validée :
  //   const { data: sePoints } = await supabase
  //     .from("score_events").select("team_id, points");
  //   puis ajouter `se` au total ci-dessous. NON câblé pour l'instant
  //   (pas de double comptage tant que la pondération n'est pas décidée).

  type PointRow = { team_id: string | null; points_awarded: number | null };
  type BabyRow = {
    team_a_id: string | null;
    team_b_id: string | null;
    score_a: number | null;
    score_b: number | null;
    status: string | null;
  };
  type VoteRow = { target_team_id: string | null; value: number | null };

  const preds = (predPoints ?? []) as PointRow[];
  const bonuses = (bonusPoints ?? []) as PointRow[];
  const quizzes = (quizPoints ?? []) as PointRow[];
  const babies = (babyPoints ?? []) as BabyRow[];
  const votes = (votePoints ?? []) as VoteRow[];

  const map = new Map<string, TeamBreakdown>();
  for (const id of teamIds) {
    const pp = preds
      .filter((r) => r.team_id === id)
      .reduce((s, r) => s + (r.points_awarded ?? 0), 0);
    const bonus = bonuses
      .filter((r) => r.team_id === id)
      .reduce((s, r) => s + (r.points_awarded ?? 0), 0);
    const qp = quizzes
      .filter((r) => r.team_id === id)
      .reduce((s, r) => s + (r.points_awarded ?? 0), 0);
    const bp =
      babies.filter(
        (m) =>
          m.status === "finished" &&
          ((m.team_a_id === id && (m.score_a ?? 0) > (m.score_b ?? 0)) ||
            (m.team_b_id === id && (m.score_b ?? 0) > (m.score_a ?? 0)))
      ).length * 10;
    const vp = votes
      .filter((r) => r.target_team_id === id)
      .reduce((s, r) => s + (r.value ?? 0), 0);
    map.set(id, { pp, bonus, qp, bp, vp, total: pp + bonus + qp + bp + vp });
  }
  return map;
}

/** Score calculé par équipe (team_id → total). Source unique. */
export async function getTeamScores(): Promise<Record<string, number>> {
  try {
    const supabase = await createClient();
    const { data: teams } = await supabase.from("teams").select("id");
    if (!teams?.length) return {};
    const agg = await computeTeamScores(
      supabase,
      teams.map((t) => t.id)
    );
    const out: Record<string, number> = {};
    for (const [id, b] of agg) out[id] = b.total;
    return out;
  } catch {
    return {};
  }
}

export async function getTeams(): Promise<Team[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("teams")
      .select("*, members:users(*)");
    if (error || !data?.length) return MOCK_TEAMS;
    const agg = await computeTeamScores(
      supabase,
      data.map((t) => t.id)
    );
    // total_points écrasé par le score calculé (jamais la valeur de seed),
    // puis tri par ce score.
    return (data as Team[])
      .map((t) => ({ ...t, total_points: agg.get(t.id)?.total ?? 0 }))
      .sort((a, b) => b.total_points - a.total_points);
  } catch {
    return MOCK_TEAMS;
  }
}

export async function getTeamById(id: string): Promise<Team | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("teams")
      .select("*, members:users(*)")
      .eq("id", id)
      .single();
    if (error || !data) return MOCK_TEAMS.find((t) => t.id === id) ?? null;
    const agg = await computeTeamScores(supabase, [id]);
    return { ...(data as Team), total_points: agg.get(id)?.total ?? 0 };
  } catch {
    return MOCK_TEAMS.find((t) => t.id === id) ?? null;
  }
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  try {
    const supabase = await createClient();
    const { data: teams, error } = await supabase.from("teams").select("*");
    if (error || !teams?.length) return MOCK_LEADERBOARD;

    const agg = await computeTeamScores(
      supabase,
      teams.map((t) => t.id)
    );

    const rows: LeaderboardRow[] = teams.map((team) => {
      const b = agg.get(team.id) ?? ZERO;
      return {
        // total_points aligné sur le calcul, même si un composant lit
        // row.team.total_points directement.
        team: { ...team, total_points: b.total } as Team,
        points_predictions: b.pp,
        points_quiz: b.qp,
        points_babyfoot: b.bp,
        points_votes: b.vp,
        points_bonus: b.bonus,
        total: b.total,
        rank: 0,
      };
    });

    rows.sort((a, b) => b.total - a.total);
    rows.forEach((r, i) => {
      r.rank = i + 1;
    });

    return rows;
  } catch {
    return MOCK_LEADERBOARD;
  }
}
