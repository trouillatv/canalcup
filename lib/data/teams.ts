import { createClient } from "@/lib/supabase/server";
import { MOCK_TEAMS, MOCK_LEADERBOARD } from "@/lib/mock-data";
import type { Team, LeaderboardRow } from "@/lib/supabase/types";
import { SCORE_EVENT_CATEGORIES_IN_TOTAL } from "@/lib/scoring/config";

// ─────────────────────────────────────────────────────────────────────────────
//  SOURCE UNIQUE DE VÉRITÉ DU SCORE ÉQUIPE
//
//  teams.total_points (colonne DB) = dette : valeurs de seed démo figées,
//  jamais mises à jour. Elle n'est PLUS lue pour l'affichage ni le tri.
//  Tout score équipe affiché (Classement, /teams, fiche équipe, brief) est
//  recalculé ici depuis les tables de scoring granulaires, via la MÊME
//  fonction → mêmes points partout, toujours.
//
//  PONDÉRATION (G2) : chaque pilier est normalisé puis pondéré selon
//  lib/scoring/config (35 % pronos / 20 quiz / 20 baby / 25 anim / 0 votes).
//  total = Σ contributions pondérées → les pronos ne peuvent pas écraser.
//  Anti double comptage : pronos/quiz/baby/votes lus dans leurs tables
//  natives ; animations UNIQUEMENT depuis score_events (catégories de
//  l'allowlist) ; toute catégorie inconnue est ignorée + warning. Les
//  votes restent calculés (métrique sociale) mais EXCLUS du total.
// ─────────────────────────────────────────────────────────────────────────────

interface TeamBreakdown {
  // Bruts par pilier (tooltip / fiche / détail)
  predRaw: number; // pronos (predictions)
  bonusRaw: number; // bonus_predictions (ex. perfect streak)
  quizRaw: number; // quiz
  babyRaw: number; // babyfoot (10 pts / victoire)
  animRaw: number; // animations/challenges/photos (score_events allowlist)
  voteRaw: number; // votes reçus — SOCIAL, hors total
  // Contributions pondérées (colonnes du classement ; somme = total)
  weighted: {
    pronostics: number; // predictions + bonus
    quiz: number;
    babyfoot: number;
    animations: number;
  };
  total: number; // = somme des 4 contributions pondérées
}

const ZERO: TeamBreakdown = {
  predRaw: 0,
  bonusRaw: 0,
  quizRaw: 0,
  babyRaw: 0,
  animRaw: 0,
  voteRaw: 0,
  weighted: { pronostics: 0, quiz: 0, babyfoot: 0, animations: 0 },
  total: 0,
};

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
    { data: scoreEvents },
  ] = await Promise.all([
    supabase.from("predictions").select("team_id, points_awarded"),
    supabase.from("bonus_predictions").select("team_id, points_awarded"),
    supabase.from("quiz_answers").select("team_id, points_awarded"),
    supabase.from("babyfoot_matches").select("team_a_id, team_b_id, score_a, score_b, status"),
    supabase.from("votes").select("target_team_id, value"),
    // Animations : UNIQUEMENT score_events (allowlist de catégories).
    supabase.from("score_events").select("team_id, category, raw_points"),
  ]);

  type PointRow = { team_id: string | null; points_awarded: number | null };
  type BabyRow = {
    team_a_id: string | null;
    team_b_id: string | null;
    score_a: number | null;
    score_b: number | null;
    status: string | null;
  };
  type VoteRow = { target_team_id: string | null; value: number | null };
  type SeRow = { team_id: string | null; category: string | null; raw_points: number | null };

  const preds = (predPoints ?? []) as PointRow[];
  const bonuses = (bonusPoints ?? []) as PointRow[];
  const quizzes = (quizPoints ?? []) as PointRow[];
  const babies = (babyPoints ?? []) as BabyRow[];
  const votes = (votePoints ?? []) as VoteRow[];
  const events = (scoreEvents ?? []) as SeRow[];

  // Garde-fou anti double comptage : on ne somme que les catégories de
  // l'allowlist (pilier animations). Toute autre catégorie est IGNORÉE du
  // total et signalée une fois (un futur ajout ne fausse pas le score).
  const allowed = new Set<string>(SCORE_EVENT_CATEGORIES_IN_TOTAL);
  const unknownCats = new Set<string>();
  for (const e of events) {
    if (e.category && !allowed.has(e.category)) unknownCats.add(e.category);
  }
  if (unknownCats.size > 0) {
    console.warn(
      `[scoring] score_events catégories hors allowlist ignorées du total : ${[...unknownCats].join(", ")}`
    );
  }

  const map = new Map<string, TeamBreakdown>();
  for (const id of teamIds) {
    const predRaw = preds
      .filter((r) => r.team_id === id)
      .reduce((s, r) => s + (r.points_awarded ?? 0), 0);
    const bonusRaw = bonuses
      .filter((r) => r.team_id === id)
      .reduce((s, r) => s + (r.points_awarded ?? 0), 0);
    const quizRaw = quizzes
      .filter((r) => r.team_id === id)
      .reduce((s, r) => s + (r.points_awarded ?? 0), 0);
    const babyRaw =
      babies.filter(
        (m) =>
          m.status === "finished" &&
          ((m.team_a_id === id && (m.score_a ?? 0) > (m.score_b ?? 0)) ||
            (m.team_b_id === id && (m.score_b ?? 0) > (m.score_a ?? 0)))
      ).length * 10;
    const voteRaw = votes
      .filter((r) => r.target_team_id === id)
      .reduce((s, r) => s + (r.value ?? 0), 0);
    const animRaw = events
      .filter((e) => e.team_id === id && e.category != null && allowed.has(e.category))
      .reduce((s, e) => s + (e.raw_points ?? 0), 0);

    // MODÈLE POINTS BRUTS (2026-05) : le score d'ÉQUIPE = activités par binôme,
    // à leur valeur brute (1 pt gagné = 1 pt équipe). Seuls babyfoot +
    // animations/défis RSE comptent. Pronostics et quiz sont PERSONNELS
    // (hors score équipe) ; votes = social (déjà hors total).
    const weighted = {
      pronostics: 0, // perso — hors score équipe
      quiz: 0, // perso — hors score équipe
      babyfoot: babyRaw,
      animations: animRaw,
    };
    const total = babyRaw + animRaw;

    map.set(id, {
      predRaw,
      bonusRaw,
      quizRaw,
      babyRaw,
      animRaw,
      voteRaw,
      weighted,
      total,
    });
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
        points_predictions: b.predRaw,
        points_bonus: b.bonusRaw,
        points_quiz: b.quizRaw,
        points_babyfoot: b.babyRaw,
        points_animations: b.animRaw,
        points_votes: b.voteRaw,
        weighted: b.weighted,
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
