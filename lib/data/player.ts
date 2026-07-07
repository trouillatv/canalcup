// ─────────────────────────────────────────────────────────────────────────────
//  FICHE JOUEUR (/joueur/[id]) — page de JEU, pas un audit.
//
//  Stats de jeu uniquement (pas de temps passé / fréquence de connexion /
//  email / historique exhaustif). Réutilise les classements existants pour les
//  rangs et computeTeamScores pour les points d'équipe.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@/lib/supabase/server";
import { getIndividualLeaderboard, getLeaderboard, computeTeamScores } from "@/lib/data/teams";
import { getServiceLeaderboard } from "@/lib/data/users";
import { getAdminEmails } from "@/lib/data/roles";
import { getPredictionOutcome, type PredictionOutcome } from "@/lib/scoring";
import { JOKER_CATALOG, type JokerType } from "@/lib/jokers/catalog";

export type PredStatus = "exact" | "correct" | "missed" | "pending";

export interface PlayerDashboard {
  user: {
    id: string;
    display_name: string;
    initials: string;
    service_name: string | null;
    football_level: string | null;
    team_id: string | null;
    team_name: string | null;
    created_at: string | null;
  };
  ranks: {
    individual: { rank: number; total: number; outOf: number } | null;
    team: { rank: number; total: number; outOf: number; teamName: string } | null;
    service: { rank: number; outOf: number; serviceName: string; average: number } | null;
  };
  individualScore: { total: number; pronos: number; quiz: number; babyfoot: number; animations: number };
  teamScore: { total: number; babyfoot: number; animations: number } | null;
  predictionStats: {
    count: number;
    points: number;
    /** Points pronos PURS (hors effet Quitte/Kamikaze, qui écrasent le prono). */
    pronoOnlyPoints: number;
    finishedCount: number;
    exact: number;
    correct: number;
    missed: number;
    pending: number;
    exactPct: number;
    correctPct: number;
    missedPct: number;
    bestStreak: number;
    currentStreak: number;
    recent: { id: string; label: string; status: PredStatus; score: string; points: number; created_at: string }[];
  };
  jokerStats: {
    played: number;
    points: number;
    byType: { type: string; emoji: string; name: string; count: number; points: number }[];
  };
  quizStats: { count: number; correct: number; correctPct: number; fast: number; points: number };
  babyfootStats: { teamName: string; wins: number; tournaments: number; bestLabel: string | null } | null;
  animationStats: { participations: number; points: number };
  recentActivity: { type: string; emoji: string; label: string; created_at: string }[];
  predictionHeatmap: { id: string; outcome: PredictionOutcome; predicted: string; actual: string | null; label: string; created_at: string }[];
}

// Heatmap collective d'une équipe : une ligne par membre, ses pronos sur les
// matchs TERMINÉS (ordre chronologique). Voir qui porte les pronos / qui rate.
export interface TeamHeatRow {
  name: string;
  items: { id: string; outcome: PredictionOutcome; predicted: string; actual: string | null; label: string }[];
}

export async function getTeamPredictionHeatmap(teamId: string): Promise<TeamHeatRow[]> {
  const supabase = await createClient();
  const [{ data: membersRaw }, { data: matches }, adminEmails] = await Promise.all([
    supabase.from("users").select("id, display_name, name, email").eq("team_id", teamId),
    supabase.from("matches").select("id, status, score_a, score_b, score_reg_a, score_reg_b, starts_at, team_a, team_b"),
    getAdminEmails(),
  ]);
  // Admins exclus (organisateurs, pas des joueurs).
  const members = (membersRaw ?? []).filter(
    (m: { email: string | null }) => !adminEmails.has((m.email ?? "").toLowerCase())
  );
  if (!members.length) return [];

  type M = { id: string; status: string; score_a: number | null; score_b: number | null; starts_at: string; team_a: string; team_b: string };
  const matchById = new Map((matches ?? []).map((m: M) => [m.id, m]));
  const ids = members.map((m: { id: string }) => m.id);

  const { data: preds } = await supabase
    .from("predictions")
    .select("id, user_id, match_id, predicted_score_a, predicted_score_b")
    .in("user_id", ids);

  type P = { id: string; user_id: string; match_id: string | null; predicted_score_a: number | null; predicted_score_b: number | null };
  const byUser = new Map<string, P[]>();
  for (const p of (preds ?? []) as P[]) {
    if (!byUser.has(p.user_id)) byUser.set(p.user_id, []);
    byUser.get(p.user_id)!.push(p);
  }

  return (members as { id: string; display_name: string | null; name: string | null }[]).map((mem) => {
    const items = (byUser.get(mem.id) ?? [])
      .map((p) => {
        const m = p.match_id ? matchById.get(p.match_id) : undefined;
        return { p, m, starts: m?.starts_at ?? "" };
      })
      .filter(({ m }) => m && m.status === "finished") // colonnes = matchs terminés
      .sort((a, b) => (a.starts < b.starts ? -1 : 1))
      .map(({ p, m }) => ({
        id: p.id,
        outcome: getPredictionOutcome(p, m ?? null),
        predicted: p.predicted_score_a != null && p.predicted_score_b != null ? `${p.predicted_score_a}–${p.predicted_score_b}` : "—",
        actual: m && m.score_a != null && m.score_b != null ? `${m.score_a}–${m.score_b}` : null,
        label: m ? `${m.team_a} – ${m.team_b}` : "Match",
      }));
    return { name: mem.display_name ?? mem.name ?? "Joueur", items };
  });
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

// Heatmap "mur des pronos" pour le Mode TV : les ~6 meilleurs joueurs du
// classement individuel, avec leurs ~8 derniers pronos (issue via
// getPredictionOutcome). Colonnes = pronos du plus ancien au plus récent.
export interface TvHeatmapRow {
  name: string;
  cells: PredictionOutcome[];
}

export async function getTvPredictionHeatmap(): Promise<TvHeatmapRow[]> {
  const TOP_PLAYERS = 6;
  const LAST_PREDICTIONS = 8;

  const individual = await getIndividualLeaderboard();
  const top = individual
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_PLAYERS);
  if (!top.length) return [];

  const supabase = await createClient();
  const ids = top.map((r) => r.user_id);

  const [{ data: matches }, { data: preds }] = await Promise.all([
    supabase.from("matches").select("id, status, score_a, score_b, score_reg_a, score_reg_b, starts_at"),
    supabase
      .from("predictions")
      .select("id, user_id, match_id, predicted_score_a, predicted_score_b, created_at")
      .in("user_id", ids),
  ]);

  type M = { id: string; status: string; score_a: number | null; score_b: number | null; starts_at: string };
  const matchById = new Map((matches ?? []).map((m: M) => [m.id, m]));

  type P = { id: string; user_id: string; match_id: string | null; predicted_score_a: number | null; predicted_score_b: number | null; created_at: string };
  const byUser = new Map<string, P[]>();
  for (const p of (preds ?? []) as P[]) {
    if (!byUser.has(p.user_id)) byUser.set(p.user_id, []);
    byUser.get(p.user_id)!.push(p);
  }

  const rows = top.map((player) => {
    const cells = (byUser.get(player.user_id) ?? [])
      .map((p) => {
        const m = p.match_id ? matchById.get(p.match_id) : undefined;
        return { p, m, ts: m?.starts_at ?? p.created_at };
      })
      .sort((a, b) => (a.ts < b.ts ? -1 : 1))
      .slice(-LAST_PREDICTIONS)
      .map(({ p, m }) => getPredictionOutcome(p, m ?? null));
    return { name: player.display_name ?? "Anonyme", cells };
  });

  return rows.filter((r) => r.cells.length > 0);
}

export async function getPlayerDashboard(userId: string): Promise<PlayerDashboard | null> {
  const supabase = await createClient();

  const { data: u } = await supabase
    .from("users")
    .select("id, display_name, name, service_id, football_level, team_id, created_at, email")
    .eq("id", userId)
    .maybeSingle();
  if (!u) return null;

  // Les admins (organisateurs) ne sont pas des joueurs : pas de fiche.
  const adminEmails = await getAdminEmails();
  if (adminEmails.has((u.email ?? "").toLowerCase())) return null;

  const displayName: string = u.display_name ?? u.name ?? "Joueur";

  const [
    { data: svc },
    { data: team },
    { data: preds },
    { data: matches },
    { data: quizzes },
    { data: entries },
    { data: parts },
    { data: challenges },
    { data: jplays },
    individuals,
    teamRows,
    serviceRows,
  ] = await Promise.all([
    u.service_id ? supabase.from("services").select("name").eq("id", u.service_id).maybeSingle() : Promise.resolve({ data: null }),
    u.team_id ? supabase.from("teams").select("id, name").eq("id", u.team_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("predictions").select("id, match_id, predicted_score_a, predicted_score_b, points_awarded, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("matches").select("id, status, score_a, score_b, score_reg_a, score_reg_b, starts_at, team_a, team_b"),
    supabase.from("quiz_answers").select("id, is_correct, response_time_ms, points_awarded, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("challenge_entries").select("id, challenge_id, points_awarded, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("challenge_entry_participants").select("entry_id, created_at").eq("user_id", userId),
    supabase.from("challenges").select("id, title"),
    supabase.from("joker_plays").select("joker_type, status, metadata, created_at").eq("played_by_user_id", userId),
    getIndividualLeaderboard(),
    getLeaderboard(),
    getServiceLeaderboard(),
  ]);

  // ─── Rangs ───────────────────────────────────────────────────────────────
  const indivRow = individuals.find((r) => r.user_id === userId) ?? null;
  const individual = indivRow
    ? { rank: indivRow.rank, total: indivRow.total, outOf: individuals.length }
    : null;

  const teamRow = u.team_id ? teamRows.find((r) => r.team.id === u.team_id) ?? null : null;
  const teamRank = teamRow
    ? { rank: teamRow.rank, total: teamRow.total, outOf: teamRows.length, teamName: teamRow.team.name }
    : null;

  const svcName = (svc as { name: string } | null)?.name ?? null;
  const svcRow = svcName ? serviceRows.find((r) => r.service.name === svcName) ?? null : null;
  const service = svcRow
    ? { rank: svcRow.rank, outOf: serviceRows.length, serviceName: svcRow.service.name, average: svcRow.average }
    : null;

  // Score individuel (pondéré) depuis le classement individuel.
  const individualScore = {
    total: indivRow?.total ?? 0,
    pronos: indivRow?.pronos ?? 0,
    quiz: indivRow?.quiz ?? 0,
    babyfoot: indivRow?.babyfoot ?? 0,
    animations: indivRow?.animations ?? 0,
  };
  const teamScore = teamRow
    ? { total: teamRow.total, babyfoot: teamRow.points_babyfoot, animations: teamRow.weighted.animations }
    : null;

  // ─── Stats pronostics ──────────────────────────────────────────────────────
  type M = { id: string; status: string; score_a: number | null; score_b: number | null; starts_at: string; team_a: string; team_b: string };
  const matchById = new Map((matches ?? []).map((m: M) => [m.id, m]));
  type P = { id: string; match_id: string | null; predicted_score_a: number | null; predicted_score_b: number | null; points_awarded: number | null; created_at: string };
  const predList = (preds ?? []) as P[];

  // Même logique que le settlement (getPredictionOutcome) ; on replie les 5
  // issues sur les 4 statuts d'affichage (correct_diff → correct).
  const classify = (p: P): PredStatus => {
    const o = getPredictionOutcome(p, p.match_id ? matchById.get(p.match_id) ?? null : null);
    return o === "exact" ? "exact" : o === "wrong" ? "missed" : o === "pending" ? "pending" : "correct";
  };

  let exact = 0, correct = 0, missed = 0, pending = 0;
  for (const p of predList) {
    const s = classify(p);
    if (s === "exact") exact++; else if (s === "correct") correct++; else if (s === "missed") missed++; else pending++;
  }
  const finishedCount = exact + correct + missed;
  const pct = (n: number) => (finishedCount > 0 ? Math.round((n / finishedCount) * 100) : 0);

  // Séries de scores exacts (ordre chronologique = par date de match).
  const chrono = [...predList]
    .filter((p) => p.match_id && matchById.get(p.match_id)?.status === "finished")
    .sort((a, b) => {
      const ma = matchById.get(a.match_id!)!.starts_at;
      const mb = matchById.get(b.match_id!)!.starts_at;
      return ma < mb ? -1 : ma > mb ? 1 : 0;
    });
  let bestStreak = 0, run = 0, currentStreak = 0;
  for (const p of chrono) {
    if (classify(p) === "exact") { run++; bestStreak = Math.max(bestStreak, run); } else run = 0;
  }
  // série en cours = run d'exacts à la fin de la chronologie
  for (let i = chrono.length - 1; i >= 0; i--) {
    if (classify(chrono[i]) === "exact") currentStreak++; else break;
  }

  const predPoints = predList.reduce((s, p) => s + (p.points_awarded ?? 0), 0);

  // ─── Stats jokers ───────────────────────────────────────────────────────────
  // Points jokers qui pèsent sur le score PERSO (pilier pronos) :
  //  • Casino → metadata.points_delta (compté à part, hors predictions) ;
  //  • Quitte ou Double / Kamikaze → metadata.points (écrasent le prono concerné,
  //    donc DÉJÀ inclus dans predPoints → on les soustrait pour isoler le prono pur).
  // Les jokers offensifs (Carton Rouge, Brouillard, Jet Lag, VAR, Espion) ne
  // rapportent pas de points perso → 0.
  type JP = { joker_type: string; status: string; metadata: Record<string, unknown> | null; created_at: string };
  const jokerPlays = (jplays ?? []) as JP[];
  const jokerPointsOf = (jp: JP): number => {
    if (jp.joker_type === "casino") return Number((jp.metadata as { points_delta?: unknown } | null)?.points_delta ?? 0);
    if (jp.joker_type === "quitte_ou_double" || jp.joker_type === "kamikaze") return Number((jp.metadata as { points?: unknown } | null)?.points ?? 0);
    return 0;
  };
  let jokerEmbeddedInPronos = 0; // QouD + Kamikaze (déjà dans predPoints)
  let jokerPointsTotal = 0;
  const jokerByType = new Map<string, { count: number; points: number }>();
  for (const jp of jokerPlays) {
    const pts = jokerPointsOf(jp);
    if (Number.isFinite(pts)) {
      jokerPointsTotal += pts;
      if (jp.joker_type === "quitte_ou_double" || jp.joker_type === "kamikaze") jokerEmbeddedInPronos += pts;
    }
    const e = jokerByType.get(jp.joker_type) ?? { count: 0, points: 0 };
    e.count += 1;
    e.points += Number.isFinite(pts) ? pts : 0;
    jokerByType.set(jp.joker_type, e);
  }
  const jokerStats = {
    played: jokerPlays.length,
    points: Math.round(jokerPointsTotal),
    byType: [...jokerByType.entries()]
      .map(([type, v]) => ({
        type,
        emoji: JOKER_CATALOG[type as JokerType]?.emoji ?? "🃏",
        name: JOKER_CATALOG[type as JokerType]?.name ?? type,
        count: v.count,
        points: Math.round(v.points),
      }))
      .sort((a, b) => b.count - a.count),
  };
  // Points pronos PURS (sans l'effet des jokers Quitte/Kamikaze qui écrasent le prono).
  const pronoOnlyPoints = Math.round(predPoints - jokerEmbeddedInPronos);
  const recentPreds = predList.slice(0, 6).map((p) => {
    const m = p.match_id ? matchById.get(p.match_id) : undefined;
    const finished = m?.status === "finished" && m.score_a != null && m.score_b != null;
    return {
      id: p.id,
      label: m ? `${m.team_a} – ${m.team_b}` : "Match",
      status: classify(p),
      score: p.predicted_score_a != null && p.predicted_score_b != null ? `${p.predicted_score_a}–${p.predicted_score_b}` : "—",
      points: finished ? p.points_awarded ?? 0 : 0,
      created_at: p.created_at,
    };
  });

  // ─── Stats quiz ──────────────────────────────────────────────────────────
  type Q = { id: string; is_correct: boolean; response_time_ms: number | null; points_awarded: number | null; created_at: string };
  const quizList = (quizzes ?? []) as Q[];
  const quizCorrect = quizList.filter((q) => q.is_correct).length;
  const quizFast = quizList.filter((q) => (q.response_time_ms ?? 99999) < 5000).length;
  const quizPts = quizList.reduce((s, q) => s + (q.points_awarded ?? 0), 0);

  // ─── Babyfoot / animations ─────────────────────────────────────────────────
  let babyfootStats: PlayerDashboard["babyfootStats"] = null;
  if (u.team_id && team) {
    const agg = await computeTeamScores(supabase, [u.team_id]);
    const b = agg.get(u.team_id);
    // Palmarès baby-foot du binôme (toutes éditions) : nb de tournois + meilleur résultat.
    const { data: bfEntries } = await supabase.from("babyfoot_entries").select("final_rank").eq("team_id", u.team_id);
    const ranks = (bfEntries ?? []).map((e: { final_rank: number | null }) => e.final_rank).filter((x): x is number => x != null);
    const best = ranks.length ? Math.min(...ranks) : null;
    const bestLabel = best === 1 ? "Champion 🏆" : best === 2 ? "Finaliste" : best === 3 ? "3e place" : best != null ? "Qualifié" : null;
    babyfootStats = {
      teamName: (team as { name: string }).name,
      wins: Math.round((b?.babyRaw ?? 0) / 10),
      tournaments: bfEntries?.length ?? 0,
      bestLabel,
    };
  }

  type Entry = { id: string; challenge_id: string | null; points_awarded: number | null; created_at: string };
  const entryList = (entries ?? []) as Entry[];
  const partList = (parts ?? []) as { entry_id: string; created_at: string }[];
  const animParticipations = new Set<string>([...entryList.map((e) => e.id), ...partList.map((p) => p.entry_id)]).size;
  const animPoints = entryList.reduce((s, e) => s + (e.points_awarded ?? 0), 0);

  // ─── Activité récente (10 derniers événements de JEU) ────────────────────────
  const cTitle = new Map((challenges ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
  const activity: PlayerDashboard["recentActivity"] = [];
  for (const p of predList) {
    const m = p.match_id ? matchById.get(p.match_id) : undefined;
    activity.push({ type: "prediction", emoji: "🎯", label: `Prono ${m ? `${m.team_a}–${m.team_b}` : ""}`.trim(), created_at: p.created_at });
  }
  for (const q of quizList) activity.push({ type: "quiz", emoji: "🧠", label: q.is_correct ? "Quiz — bonne réponse" : "Quiz — réponse", created_at: q.created_at });
  for (const e of entryList) activity.push({ type: "animation", emoji: "🎉", label: `Animation : ${e.challenge_id ? cTitle.get(e.challenge_id) ?? "" : ""}`.trim(), created_at: e.created_at });
  activity.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

  // ─── Heatmap pronostics (ordre chronologique par date de match) ──────────────
  const predictionHeatmap = predList
    .map((p) => {
      const m = p.match_id ? matchById.get(p.match_id) : undefined;
      const finished = m && m.status === "finished" && m.score_a != null && m.score_b != null;
      return {
        id: p.id,
        outcome: getPredictionOutcome(p, m ?? null),
        predicted: p.predicted_score_a != null && p.predicted_score_b != null ? `${p.predicted_score_a}–${p.predicted_score_b}` : "—",
        actual: finished ? `${m!.score_a}–${m!.score_b}` : null,
        label: m ? `${m.team_a} – ${m.team_b}` : "Match",
        created_at: m?.starts_at ?? p.created_at,
      };
    })
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  return {
    user: {
      id: u.id,
      display_name: displayName,
      initials: initialsOf(displayName),
      service_name: svcName,
      football_level: u.football_level ?? null,
      team_id: u.team_id ?? null,
      team_name: (team as { name: string } | null)?.name ?? null,
      created_at: u.created_at ?? null,
    },
    ranks: { individual, team: teamRank, service },
    individualScore,
    teamScore,
    predictionStats: {
      count: predList.length,
      points: predPoints,
      pronoOnlyPoints,
      finishedCount,
      exact, correct, missed, pending,
      exactPct: pct(exact),
      correctPct: pct(correct),
      missedPct: pct(missed),
      bestStreak,
      currentStreak,
      recent: recentPreds,
    },
    jokerStats,
    quizStats: {
      count: quizList.length,
      correct: quizCorrect,
      correctPct: quizList.length > 0 ? Math.round((quizCorrect / quizList.length) * 100) : 0,
      fast: quizFast,
      points: quizPts,
    },
    babyfootStats,
    animationStats: { participations: animParticipations, points: animPoints },
    recentActivity: activity.slice(0, 10),
    predictionHeatmap,
  };
}
