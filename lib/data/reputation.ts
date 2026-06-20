// ─────────────────────────────────────────────────────────────────────────────
//  Moteur de RÉPUTATION Canal Cup (titres + badges) — SERVEUR.
//
//  Tout est DÉRIVÉ des données existantes (predictions settlées + quiz), comme
//  les Médailles Absurdes — mais par JOUEUR (pas par équipe). 0 nouvelle table.
//
//   • Titre = 1 étiquette « headline » par joueur. Titres EXCLUSIFS (le meilleur
//     du groupe sur un critère) sinon titre « personnalité » dérivé de ses props.
//   • Badges = succès cumulatifs à seuils (1er score exact, 10 pronos, …) avec
//     progression, façon achievements.
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/data/select-all";
import { getAdminEmails } from "@/lib/data/roles";

export interface Title { key: string; emoji: string; label: string; description: string; exclusive: boolean }
export interface Badge { key: string; emoji: string; label: string; description: string; earned: boolean; current: number; target: number }
export interface Reputation { title: Title | null; badges: Badge[] }

interface UserAgg {
  userId: string;
  total: number;
  exact: number;
  correctResult: number;
  zeroPoints: number;
  draws: number;
  sumPoints: number;
  predGoals: number;
  oneNil: number;        // pronos "1-0" (dans un sens ou l'autre)
  quizCount: number;
  quizPoints: number;
}

type PredRow = {
  user_id: string | null;
  predicted_score_a: number | null;
  predicted_score_b: number | null;
  points_awarded: number | null;
  match: { score_a: number | null; score_b: number | null; is_settled: boolean | null } | null;
};
type QuizRow = { user_id: string | null; points_awarded: number | null };

// Cache court : le calcul scanne toutes les prédictions, inutile de recommencer
// à chaque vue de fiche. 2 min suffisent (mis à jour après chaque match).
let CACHE: { at: number; map: Map<string, Reputation> } | null = null;
const TTL_MS = 120_000;

async function computeAll(): Promise<Map<string, Reputation>> {
  const supabase = createAdminClient();
  const [preds, quizzes, users, adminEmails] = await Promise.all([
    selectAll<PredRow>(supabase, "predictions", "user_id, predicted_score_a, predicted_score_b, points_awarded, match:matches(score_a, score_b, is_settled)"),
    selectAll<QuizRow>(supabase, "quiz_answers", "user_id, points_awarded"),
    selectAll<{ id: string; email: string | null }>(supabase, "users", "id, email"),
    getAdminEmails(),
  ]);

  const isAdmin = new Set(
    users.filter((u) => adminEmails.has((u.email ?? "").toLowerCase())).map((u) => u.id)
  );

  const agg = new Map<string, UserAgg>();
  const ensure = (id: string): UserAgg => {
    let a = agg.get(id);
    if (!a) { a = { userId: id, total: 0, exact: 0, correctResult: 0, zeroPoints: 0, draws: 0, sumPoints: 0, predGoals: 0, oneNil: 0, quizCount: 0, quizPoints: 0 }; agg.set(id, a); }
    return a;
  };

  for (const p of preds) {
    if (!p.user_id || isAdmin.has(p.user_id)) continue;
    if (!p.match?.is_settled || p.match.score_a == null || p.match.score_b == null) continue;
    const pa = p.predicted_score_a ?? 0, pb = p.predicted_score_b ?? 0;
    const a = ensure(p.user_id);
    a.total++;
    a.sumPoints += p.points_awarded ?? 0;
    a.predGoals += pa + pb;
    const exact = pa === p.match.score_a && pb === p.match.score_b;
    if (exact) a.exact++;
    else if ((p.points_awarded ?? 0) > 0) a.correctResult++;
    if ((p.points_awarded ?? 0) === 0) a.zeroPoints++;
    if (pa === pb) a.draws++;
    if ((pa === 1 && pb === 0) || (pa === 0 && pb === 1)) a.oneNil++;
  }
  for (const q of quizzes) {
    if (!q.user_id || isAdmin.has(q.user_id)) continue;
    const a = ensure(q.user_id);
    a.quizCount++;
    a.quizPoints += q.points_awarded ?? 0;
  }

  const all = [...agg.values()];

  // ── Titres EXCLUSIFS : le leader du groupe sur un critère (seuil mini). ──
  // Ordre = priorité d'affichage (le 1er gagné prime pour le headline).
  const leaderboards: { title: Title; pick: (rows: UserAgg[]) => UserAgg | null }[] = [
    { title: { key: "oracle", emoji: "🔮", label: "L'Oracle", description: "Plus gros total de points aux pronostics du groupe.", exclusive: true },
      pick: (r) => best(r.filter((x) => x.total >= 5), (x) => x.sumPoints) },
    { title: { key: "visionnaire", emoji: "🎯", label: "Le Visionnaire", description: "Recordman de scores exacts.", exclusive: true },
      pick: (r) => best(r.filter((x) => x.total >= 5 && x.exact >= 2), (x) => x.exact) },
    { title: { key: "escroc_quiz", emoji: "🧠", label: "L'Escroc du Quiz", description: "Plus gros score au quiz.", exclusive: true },
      pick: (r) => best(r.filter((x) => x.quizCount >= 5), (x) => x.quizPoints) },
    { title: { key: "roi_nul", emoji: "🤝", label: "Le Roi du Nul", description: "Le plus de pronostics de match nul.", exclusive: true },
      pick: (r) => best(r.filter((x) => x.draws >= 3), (x) => x.draws) },
    { title: { key: "monsieur_un_zero", emoji: "1️⃣", label: "Monsieur 1-0", description: "Adepte du petit 1-0.", exclusive: true },
      pick: (r) => best(r.filter((x) => x.oneNil >= 3), (x) => x.oneNil) },
    { title: { key: "chat_noir", emoji: "⚫", label: "Le Chat Noir", description: "Le plus fort taux de pronostics à 0 point.", exclusive: true },
      pick: (r) => best(r.filter((x) => x.total >= 5), (x) => x.zeroPoints / x.total) },
  ];

  const titleByUser = new Map<string, Title>();
  for (const lb of leaderboards) {
    const winner = lb.pick(all);
    if (winner && !titleByUser.has(winner.userId)) titleByUser.set(winner.userId, lb.title);
  }

  const result = new Map<string, Reputation>();
  for (const a of all) {
    const title = titleByUser.get(a.userId) ?? personalityTitle(a);
    result.set(a.userId, { title, badges: badgesFor(a) });
  }
  return result;
}

function best(rows: UserAgg[], score: (u: UserAgg) => number): UserAgg | null {
  let top: UserAgg | null = null, bestV = -Infinity;
  for (const r of rows) { const v = score(r); if (v > bestV) { bestV = v; top = r; } }
  return top;
}

// Titre « personnalité » dérivé des seules stats du joueur (aucun exclusif gagné).
function personalityTitle(a: UserAgg): Title {
  const t = (key: string, emoji: string, label: string, description: string): Title => ({ key, emoji, label, description, exclusive: false });
  if (a.total === 0 && a.quizCount === 0) return t("nouveau", "🌱", "La Recrue", "Bienvenue ! Premiers pronostics à venir.");
  if (a.exact >= 1) return t("sniper", "🎯", "Le Sniper", "Au moins un score exact à son actif.");
  const avgGoals = a.total ? a.predGoals / a.total : 0;
  if (a.draws >= 2) return t("adepte_nul", "🤝", "L'Adepte du Nul", "Voit des matchs nuls un peu partout.");
  if (avgGoals >= 3) return t("attaquant", "🚀", "L'Attaquant", "Pronostique des matchs à buts.");
  if (a.total >= 10 && avgGoals <= 1.6) return t("prudent", "🛡️", "Le Prudent", "Des scores serrés, une défense de fer.");
  if (a.total >= 10) return t("regulier", "📊", "Le Régulier", "Toujours au rendez-vous des pronostics.");
  return t("pronostiqueur", "⚽", "Le Pronostiqueur", "En route vers la gloire.");
}

function badgesFor(a: UserAgg): Badge[] {
  const mk = (key: string, emoji: string, label: string, description: string, current: number, target: number): Badge =>
    ({ key, emoji, label, description, current: Math.min(current, target), target, earned: current >= target });
  return [
    mk("exact_1", "🎯", "Premier score exact", "Trouver un score exact.", a.exact, 1),
    mk("exact_5", "🎯", "Tireur d'élite", "5 scores exacts.", a.exact, 5),
    mk("exact_10", "🏹", "Maître Oracle", "10 scores exacts.", a.exact, 10),
    mk("pronos_10", "📊", "Pronostiqueur assidu", "10 pronostics joués.", a.total, 10),
    mk("pronos_30", "🔥", "Marathonien", "30 pronostics joués.", a.total, 30),
    mk("points_100", "💯", "Centurion", "100 points aux pronostics.", a.sumPoints, 100),
    mk("quiz_10", "🧠", "Cerveau du quiz", "10 questions de quiz répondues.", a.quizCount, 10),
  ];
}

// Map complète (cachée) — évite N calculs concurrents quand on enrichit une
// liste (classement). computeAll() n'est lancé qu'une fois par fenêtre de cache.
let INFLIGHT: Promise<Map<string, Reputation>> | null = null;
export async function getReputationMap(): Promise<Map<string, Reputation>> {
  if (CACHE && Date.now() - CACHE.at <= TTL_MS) return CACHE.map;
  if (!INFLIGHT) {
    INFLIGHT = computeAll().then((map) => { CACHE = { at: Date.now(), map }; INFLIGHT = null; return map; });
  }
  return INFLIGHT;
}

const emptyAgg = (userId: string): UserAgg => ({ userId, total: 0, exact: 0, correctResult: 0, zeroPoints: 0, draws: 0, sumPoints: 0, predGoals: 0, oneNil: 0, quizCount: 0, quizPoints: 0 });

export async function getReputation(userId: string): Promise<Reputation> {
  const map = await getReputationMap();
  return map.get(userId) ?? { title: personalityTitle(emptyAgg(userId)), badges: badgesFor(emptyAgg(userId)) };
}
