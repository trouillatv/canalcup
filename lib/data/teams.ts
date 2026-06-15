import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Team, LeaderboardRow } from "@/lib/supabase/types";
import { SCORE_EVENT_CATEGORIES_IN_TOTAL, weightedContribution } from "@/lib/scoring/config";
import { getAdminEmails } from "@/lib/data/roles";

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

    // Pondération d'origine (pronos 35 / quiz 20 / baby 20 / anim 25 %).
    // RÈGLE (2026-05) : pronos + quiz = INDIVIDUELS → calculés (stats perso)
    // mais EXCLUS du total d'ÉQUIPE. Le score du binôme = babyfoot + animations
    // pondérés. Votes = social (hors total).
    const weighted = {
      pronostics: weightedContribution("pronostics", predRaw + bonusRaw),
      quiz: weightedContribution("quiz", quizRaw),
      babyfoot: weightedContribution("babyfoot", babyRaw),
      animations: weightedContribution("animations", animRaw),
    };
    const total = weighted.babyfoot + weighted.animations;

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
    const admin = createAdminClient();
    // Source de vérité des membres : team_memberships (pas users.team_id)
    const [{ data, error }, { data: memberships }] = await Promise.all([
      admin.from("teams").select("*"),
      admin.from("team_memberships").select("team_id, user:users(id, display_name, name)"),
    ]);
    if (error) return [];
    if (!data?.length) return [];

    // Groupe les membres par team_id
    type MRow = { team_id: string; user: { id: string; display_name: string | null; name: string | null } | null };
    const byTeam = new Map<string, { id: string; display_name: string | null; name: string | null }[]>();
    for (const row of (memberships ?? []) as unknown as MRow[]) {
      if (!row.user) continue;
      if (!byTeam.has(row.team_id)) byTeam.set(row.team_id, []);
      byTeam.get(row.team_id)!.push(row.user);
    }

    const agg = await computeTeamScores(supabase, data.map((t) => t.id));
    return (data as Team[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((t) => ({ ...t, members: (byTeam.get(t.id) ?? []) as any, total_points: agg.get(t.id)?.total ?? 0 }))
      .sort((a, b) => b.total_points - a.total_points);
  } catch {
    return [];
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
    if (error || !data) return null;
    const agg = await computeTeamScores(supabase, [id]);
    return { ...(data as Team), total_points: agg.get(id)?.total ?? 0 };
  } catch {
    return null;
  }
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  try {
    const supabase = await createClient();
    const [{ data: teams, error }, { data: members }, adminEmails] = await Promise.all([
      supabase.from("teams").select("*"),
      supabase.from("users").select("team_id, email"),
      getAdminEmails(),
    ]);
    if (error) return [];
    if (!teams?.length) return [];

    // Équipes 100% admin → exclues du classement (organisateurs hors jeu).
    // Une équipe est exclue si elle a ≥1 membre et que TOUS sont admins.
    const teamMembers = new Map<string, string[]>();
    for (const m of (members ?? []) as { team_id: string | null; email: string | null }[]) {
      if (!m.team_id) continue;
      if (!teamMembers.has(m.team_id)) teamMembers.set(m.team_id, []);
      teamMembers.get(m.team_id)!.push((m.email ?? "").toLowerCase());
    }
    const isAdminOnlyTeam = (teamId: string): boolean => {
      const emails = teamMembers.get(teamId) ?? [];
      return emails.length > 0 && emails.every((e) => adminEmails.has(e));
    };

    const agg = await computeTeamScores(
      supabase,
      teams.map((t) => t.id)
    );

    const rows: LeaderboardRow[] = teams
      .filter((team) => !isAdminOnlyTeam(team.id))
      .map((team) => {
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
    return [];
  }
}

// ─── Classement INDIVIDUEL ─────────────────────────────────────────────────────
// En plus du classement par binôme, on classe les PERSONNES. Score perso (même
// points bruts = pronos + quiz PROPRES au joueur + babyfoot + animations de
// son binôme (faits à deux → crédités aux 2 membres). Pronos/quiz sont donc
// individuels ici, baby/anim partagés par le binôme.

export interface IndividualRow {
  user_id: string;
  display_name: string | null;
  team_name: string | null;
  pronos: number; // brut (perso)
  quiz: number; // brut (perso)
  babyfoot: number; // brut (binôme, crédité aux 2)
  animations: number; // brut (binôme, crédité aux 2)
  pronosCount: number;
  quizCount: number;
  total: number;
  rank: number;
}

export async function getIndividualLeaderboard(): Promise<IndividualRow[]> {
  try {
    // Client ADMIN : le classement agrège les pronos/quiz de TOUS les joueurs.
    // Avec le client soumis à RLS, la lecture des pronos des AUTRES joueurs est
    // tronquée → totaux sous-évalués et variables selon le visiteur (un joueur
    // pouvait afficher 45 pts au classement alors qu'il en avait 55 en pronos).
    // On n'expose ici que des totaux agrégés, jamais les pronos individuels.
    const supabase = createAdminClient();
    const [
      { data: users },
      { data: teams },
      { data: preds },
      { data: bonuses },
      { data: quizzes },
      adminEmails,
    ] = await Promise.all([
      supabase.from("users").select("id, display_name, name, team_id, email"),
      supabase.from("teams").select("id, name"),
      supabase.from("predictions").select("user_id, points_awarded, match:matches(is_settled)"),
      supabase.from("bonus_predictions").select("user_id, points_awarded"),
      supabase.from("quiz_answers").select("user_id, points_awarded"),
      getAdminEmails(),
    ]);
    if (!users?.length) return [];

    const teamName = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
    // Réutilise le calcul d'équipe pour babyRaw / animRaw par binôme.
    const teamAgg = await computeTeamScores(supabase, (teams ?? []).map((t: { id: string }) => t.id));

    type PtRow = { user_id: string | null; points_awarded: number | null };
    // Le prono embarque le match pour distinguer « évalué » (match settled) de
    // « en attente » : points_awarded vaut 0 dans les deux cas (colonne NOT NULL
    // DEFAULT 0), donc seul is_settled permet de compter les pronos réellement notés.
    type PredRow = PtRow & { match: { is_settled: boolean | null } | null };
    const pronosRaw = new Map<string, number>();
    const quizRaw = new Map<string, number>();
    const pronosCount = new Map<string, number>();
    const quizCount = new Map<string, number>();
    const add = (m: Map<string, number>, id: string | null, n: number | null) => {
      if (!id) return;
      m.set(id, (m.get(id) ?? 0) + (n ?? 0));
    };
    const inc = (m: Map<string, number>, id: string | null) => {
      if (!id) return;
      m.set(id, (m.get(id) ?? 0) + 1);
    };
    for (const r of (preds ?? []) as unknown as PredRow[]) {
      add(pronosRaw, r.user_id, r.points_awarded);
      if (r.match?.is_settled) inc(pronosCount, r.user_id); // matchs évalués uniquement
    }
    for (const r of (bonuses ?? []) as PtRow[]) add(pronosRaw, r.user_id, r.points_awarded);
    for (const r of (quizzes ?? []) as PtRow[]) {
      add(quizRaw, r.user_id, r.points_awarded);
      inc(quizCount, r.user_id);
    }

    type URow = { id: string; display_name: string | null; name: string | null; team_id: string | null; email: string | null };
    const rows: IndividualRow[] = (users as URow[])
      .filter((u) => !adminEmails.has((u.email ?? "").toLowerCase())) // admins hors classement
      .map((u) => {
        const tb = u.team_id ? teamAgg.get(u.team_id) : undefined;
        const pronos = Math.round(pronosRaw.get(u.id) ?? 0);
        const quiz = Math.round(quizRaw.get(u.id) ?? 0);
        const babyfoot = Math.round(tb?.babyRaw ?? 0);
        const animations = Math.round(tb?.animRaw ?? 0);
        return {
          user_id: u.id,
          display_name: u.display_name ?? u.name ?? null,
          team_name: u.team_id ? teamName.get(u.team_id) ?? null : null,
          pronos, quiz, babyfoot, animations,
          pronosCount: pronosCount.get(u.id) ?? 0,
          quizCount: quizCount.get(u.id) ?? 0,
          total: pronos + quiz + babyfoot + animations,
          rank: 0,
        };
      })
      .filter((r) => r.display_name); // joueurs identifiés

    rows.sort((a, b) => b.total - a.total);
    rows.forEach((r, i) => (r.rank = i + 1));
    return rows;
  } catch {
    return [];
  }
}
