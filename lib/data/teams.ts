import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Team, LeaderboardRow } from "@/lib/supabase/types";
import { SCORE_EVENT_CATEGORIES_IN_TOTAL, weightedContribution } from "@/lib/scoring/config";
import { quizGlobalPoints } from "@/lib/scoring";
import { getAdminEmails } from "@/lib/data/roles";
import { selectAll } from "@/lib/data/select-all";

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
  babyRaw: number; // babyfoot legacy (10 pts / victoire) — conservé pour stats, HORS total
  babyfootPoints: number; // Tournoi baby-foot : points FACIAUX (awards de l'édition active) — DANS le total
  animRaw: number; // animations/challenges/photos (score_events allowlist)
  voteRaw: number; // votes reçus — SOCIAL, hors total
  // Contributions pondérées (colonnes du classement ; somme = total)
  weighted: {
    pronostics: number; // predictions + bonus
    quiz: number;
    babyfoot: number;
    animations: number;
  };
  total: number; // = babyfootPoints (facial) + animations pondérées
}

const ZERO: TeamBreakdown = {
  predRaw: 0,
  bonusRaw: 0,
  quizRaw: 0,
  babyRaw: 0,
  babyfootPoints: 0,
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
  // Lecture paginée (selectAll) : sinon PostgREST tronque à 1000 lignes et les
  // scores agrégés sont sous-évalués dès qu'une table dépasse ce seuil.
  const [
    predPoints,
    bonusPoints,
    quizPoints,
    babyPoints,
    votePoints,
    scoreEvents,
    bfTournaments,
    bfAwards,
  ] = await Promise.all([
    selectAll<{ team_id: string | null; points_awarded: number | null }>(supabase, "predictions", "team_id, points_awarded"),
    selectAll<{ team_id: string | null; points_awarded: number | null }>(supabase, "bonus_predictions", "team_id, points_awarded"),
    selectAll<{ team_id: string | null; points_awarded: number | null }>(supabase, "quiz_answers", "team_id, points_awarded"),
    selectAll<{ team_a_id: string | null; team_b_id: string | null; score_a: number | null; score_b: number | null; status: string | null }>(supabase, "babyfoot_matches", "team_a_id, team_b_id, score_a, score_b, status"),
    selectAll<{ target_team_id: string | null; value: number | null }>(supabase, "votes", "target_team_id, value"),
    // Animations : UNIQUEMENT score_events (allowlist de catégories).
    selectAll<{ team_id: string | null; category: string | null; raw_points: number | null }>(supabase, "score_events", "team_id, category, raw_points"),
    // Tournoi baby-foot : awards de l'ÉDITION ACTIVE uniquement (les éditions
    // passées restent en base pour l'historique, sans gonfler le classement).
    selectAll<{ id: string; is_active: boolean | null }>(supabase, "babyfoot_tournaments", "id, is_active"),
    selectAll<{ tournament_id: string | null; team_id: string | null; points: number | null }>(supabase, "babyfoot_awards", "tournament_id, team_id, points"),
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

  // Tournoi baby-foot : points faciaux par équipe, restreints à l'édition active.
  const activeBfId =
    (bfTournaments ?? []).find((t) => t.is_active)?.id ?? null;
  const babyfootByTeam = new Map<string, number>();
  if (activeBfId) {
    for (const a of bfAwards ?? []) {
      if (a.tournament_id !== activeBfId || !a.team_id) continue;
      babyfootByTeam.set(a.team_id, (babyfootByTeam.get(a.team_id) ?? 0) + (a.points ?? 0));
    }
  }

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

    // babyRaw (10 pts/victoire) reste calculé pour d'éventuelles stats mais
    // n'entre PLUS dans le total : le tournoi baby-foot est désormais scoré au
    // barème FACIAL traçable (babyfoot_awards). Évite le double comptage.
    const babyfootPoints = babyfootByTeam.get(id) ?? 0;

    // Pondération d'origine conservée pour pronos/quiz (stats perso) et anim.
    // RÈGLE (2026-05) : pronos + quiz = INDIVIDUELS → calculés mais EXCLUS du
    // total d'ÉQUIPE. Votes = social (hors total).
    // RÈGLE (2026-07) : score du binôme = points baby-foot FACIAUX + animations
    // pondérées.
    const weighted = {
      pronostics: weightedContribution("pronostics", predRaw + bonusRaw),
      quiz: weightedContribution("quiz", quizRaw),
      babyfoot: weightedContribution("babyfoot", babyRaw),
      animations: weightedContribution("animations", animRaw),
    };
    const total = babyfootPoints + weighted.animations;

    map.set(id, {
      predRaw,
      bonusRaw,
      quizRaw,
      babyRaw,
      babyfootPoints,
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
        points_babyfoot: b.babyfootPoints, // tournoi baby-foot facial (édition active)
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
  quiz: number; // brut (perso) = points RÉELS du championnat quiz
  quizGlobal: number; // contribution PONDÉRÉE par rang au classement général (0 ou 5..50)
  babyfoot: number; // brut (binôme, crédité aux 2)
  animations: number; // brut (binôme, crédité aux 2)
  pronosCount: number;
  quizCount: number;
  total: number;
  rank: number;
  // Titre de réputation (rempli côté page via getReputationMap) — affichage social.
  title?: { emoji: string; label: string; exclusive: boolean } | null;
}

// Points Casino (joker) par joueur — repliés dans le pilier pronos du
// classement individuel. Le delta (+15…−10) vit dans joker_plays.metadata,
// pas dans une table de points → à agréger à part. Résilient : si la table
// joker_plays n'existe pas encore, renvoie une map vide.
async function casinoPointsByUser(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const rows = await selectAll<{
      played_by_user_id: string | null;
      joker_type: string | null;
      metadata: Record<string, unknown> | null;
    }>(supabase, "joker_plays", "played_by_user_id, joker_type, metadata");
    for (const r of rows ?? []) {
      if (r.joker_type !== "casino" || !r.played_by_user_id) continue;
      const delta = Number((r.metadata as { points_delta?: unknown } | null)?.points_delta ?? 0);
      if (!Number.isFinite(delta) || delta === 0) continue;
      out.set(r.played_by_user_id, (out.get(r.played_by_user_id) ?? 0) + delta);
    }
  } catch {
    /* table absente → pas de points casino */
  }
  return out;
}

// Points baby-foot des paires AD-HOC (kind='open') crédités par JOUEUR :
// ces paires ne donnent pas de points équipe, mais leurs joueurs RÉELS marquent
// en individuel. Règle « renfort » (p2_is_helper) : p2 dépanne, il ne gagne RIEN
// — seul p1 est crédité. Les binômes officiels passent par computeTeamScores.
// Exporté pour la validation fonctionnelle (tournamentId injectable).
export async function openBabyfootPointsByUser(
  supabase: ReturnType<typeof createAdminClient>,
  tournamentId?: string
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const [tourns, bfEntries, bfAwards] = await Promise.all([
      selectAll<{ id: string; is_active: boolean | null }>(supabase, "babyfoot_tournaments", "id, is_active"),
      selectAll<{ id: string; tournament_id: string | null; kind: string | null; p1_user_id: string | null; p2_user_id: string | null; p2_is_helper: boolean | null }>(supabase, "babyfoot_entries", "id, tournament_id, kind, p1_user_id, p2_user_id, p2_is_helper"),
      selectAll<{ entry_id: string | null; points: number | null }>(supabase, "babyfoot_awards", "entry_id, points"),
    ]);
    const activeId = tournamentId ?? ((tourns ?? []).find((t) => t.is_active)?.id ?? null);
    if (!activeId) return out;
    const ptsByEntry = new Map<string, number>();
    for (const a of bfAwards ?? []) if (a.entry_id) ptsByEntry.set(a.entry_id, (ptsByEntry.get(a.entry_id) ?? 0) + (a.points ?? 0));
    for (const e of bfEntries ?? []) {
      if (e.tournament_id !== activeId || e.kind !== "open") continue;
      const pts = ptsByEntry.get(e.id) ?? 0;
      if (!pts) continue;
      const credited = e.p2_is_helper ? [e.p1_user_id] : [e.p1_user_id, e.p2_user_id];
      for (const uid of credited) if (uid) out.set(uid, (out.get(uid) ?? 0) + pts);
    }
  } catch { /* colonnes/tables absentes → pas de crédit ad-hoc */ }
  return out;
}

export async function getIndividualLeaderboard(): Promise<IndividualRow[]> {
  try {
    // Client ADMIN : le classement agrège les pronos/quiz de TOUS les joueurs.
    // Avec le client soumis à RLS, la lecture des pronos des AUTRES joueurs est
    // tronquée → totaux sous-évalués et variables selon le visiteur (un joueur
    // pouvait afficher 45 pts au classement alors qu'il en avait 55 en pronos).
    // On n'expose ici que des totaux agrégés, jamais les pronos individuels.
    const supabase = createAdminClient();
    // selectAll : lecture paginée — sinon PostgREST tronque à 1000 lignes et
    // les totaux des joueurs dont les pronos tombent au-delà sont sous-évalués.
    const [
      users,
      teams,
      preds,
      bonuses,
      quizzes,
      casinoByUser,
      adminEmails,
    ] = await Promise.all([
      selectAll<{ id: string; display_name: string | null; name: string | null; team_id: string | null; email: string | null }>(supabase, "users", "id, display_name, name, team_id, email"),
      selectAll<{ id: string; name: string }>(supabase, "teams", "id, name"),
      selectAll<{ user_id: string | null; points_awarded: number | null; predicted_score_a: number | null; predicted_score_b: number | null; match: { is_settled: boolean | null; score_a: number | null; score_b: number | null } | null }>(supabase, "predictions", "user_id, points_awarded, predicted_score_a, predicted_score_b, match:matches(is_settled, score_a, score_b)"),
      selectAll<{ user_id: string | null; points_awarded: number | null }>(supabase, "bonus_predictions", "user_id, points_awarded"),
      selectAll<{ user_id: string | null; points_awarded: number | null }>(supabase, "quiz_answers", "user_id, points_awarded"),
      casinoPointsByUser(supabase),
      getAdminEmails(),
    ]);
    if (!users?.length) return [];

    const teamName = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
    // Réutilise le calcul d'équipe pour babyRaw / animRaw par binôme.
    const teamAgg = await computeTeamScores(supabase, (teams ?? []).map((t: { id: string }) => t.id));
    const openBabyfootByUser = await openBabyfootPointsByUser(supabase);

    type PtRow = { user_id: string | null; points_awarded: number | null };
    // Le prono embarque le match pour distinguer « évalué » (match settled) de
    // « en attente » : points_awarded vaut 0 dans les deux cas (colonne NOT NULL
    // DEFAULT 0), donc seul is_settled permet de compter les pronos réellement notés.
    type PredRow = PtRow & {
      predicted_score_a: number | null; predicted_score_b: number | null;
      match: { is_settled: boolean | null; score_a: number | null; score_b: number | null } | null;
    };
    const pronosRaw = new Map<string, number>();
    const quizRaw = new Map<string, number>();
    const pronosCount = new Map<string, number>();
    const quizCount = new Map<string, number>();
    const exactCount = new Map<string, number>(); // scores exacts (départage classement)
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
      if (r.match?.is_settled) {
        inc(pronosCount, r.user_id); // matchs évalués uniquement
        if (
          r.predicted_score_a != null && r.predicted_score_b != null &&
          r.predicted_score_a === r.match.score_a && r.predicted_score_b === r.match.score_b
        ) inc(exactCount, r.user_id);
      }
    }
    for (const r of (bonuses ?? []) as PtRow[]) add(pronosRaw, r.user_id, r.points_awarded);
    for (const r of (quizzes ?? []) as PtRow[]) {
      add(quizRaw, r.user_id, r.points_awarded);
      inc(quizCount, r.user_id);
    }
    // 🎰 Casino : points perso pliés dans le pilier pronostics (jeu de pronos).
    for (const [uid, pts] of casinoByUser) add(pronosRaw, uid, pts);

    // Contribution QUIZ au classement GÉNÉRAL : normalisée entre 5 et 50 selon le
    // SCORE quiz (meilleur = 50, plus faible participant = 5, absent = 0) — les
    // points bruts n'écrasent plus le total. Le championnat quiz garde r.quiz réel.
    const quizGlobalMap = quizGlobalPoints(quizRaw);

    type URow = { id: string; display_name: string | null; name: string | null; team_id: string | null; email: string | null };
    const rows: IndividualRow[] = (users as URow[])
      .filter((u) => !adminEmails.has((u.email ?? "").toLowerCase())) // admins hors classement
      .map((u) => {
        const tb = u.team_id ? teamAgg.get(u.team_id) : undefined;
        const pronos = Math.round(pronosRaw.get(u.id) ?? 0);
        const quiz = Math.round(quizRaw.get(u.id) ?? 0);
        const quizGlobal = quizGlobalMap.get(u.id) ?? 0;
        const babyfoot = Math.round((tb?.babyfootPoints ?? 0) + (openBabyfootByUser.get(u.id) ?? 0)); // officiel via équipe + paires ad-hoc via joueur
        const animations = Math.round(tb?.animRaw ?? 0);
        return {
          user_id: u.id,
          display_name: u.display_name ?? u.name ?? null,
          team_name: u.team_id ? teamName.get(u.team_id) ?? null : null,
          pronos, quiz, quizGlobal, babyfoot, animations,
          pronosCount: pronosCount.get(u.id) ?? 0,
          quizCount: quizCount.get(u.id) ?? 0,
          // Classement GÉNÉRAL : la contribution quiz est PONDÉRÉE par rang
          // (quizGlobal : 1er=50, dernier participant=5, absent=0) → les points
          // bruts n'écrasent plus le total. Le classement Quiz dédié affiche,
          // lui, les points RÉELS (r.quiz).
          total: pronos + quizGlobal + babyfoot + animations,
          rank: 0,
        };
      })
      .filter((r) => r.display_name); // joueurs identifiés

    // Départage : à points égaux, on classe devant celui qui a deviné le plus
    // de scores exacts (puis, à défaut, ordre stable par nom).
    rows.sort(
      (a, b) =>
        b.total - a.total ||
        (exactCount.get(b.user_id) ?? 0) - (exactCount.get(a.user_id) ?? 0) ||
        (a.display_name ?? "").localeCompare(b.display_name ?? "")
    );
    rows.forEach((r, i) => (r.rank = i + 1));
    return rows;
  } catch {
    return [];
  }
}
