// ─────────────────────────────────────────────────────────────────────────────
//  Moteur de RÉPUTATION Canal Cup (titres + badges) — SERVEUR.
//
//  Objectif game-design : fun · chambrage · social · découverte · participation.
//  Tout est DÉRIVÉ des données existantes (predictions / quiz / jokers / babyfoot
//  / votes), par JOUEUR. 0 nouvelle table. Admins exclus.
//
//   • Titre = 1 étiquette « personnalité » par joueur. Exclusifs (leader du
//     groupe) sinon trait DOMINANT → vraie distribution (plus de « tous Sniper »).
//   • Badges en 4 catégories (prestige / humour / culture / social) + SECRETS
//     (condition cachée, « ??? · débloqué par N joueurs »). Positifs ET négatifs.
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/data/select-all";
import { getAdminEmails } from "@/lib/data/roles";
import { toFrench } from "@/lib/football/team-names";

export interface Title { key: string; emoji: string; label: string; description: string; exclusive: boolean }
export type BadgeCategory = "prestige" | "humour" | "culture" | "social" | "secret";
export interface Badge {
  key: string; emoji: string; label: string; description: string;
  category: BadgeCategory; secret: boolean;
  earned: boolean; current: number; target: number;
  earnedCount?: number; // nb de joueurs ayant le badge (pour « débloqué par N »)
}
export interface Reputation { title: Title | null; badges: Badge[] }

// ─── Continents (CAF/UEFA/CONMEBOL/CONCACAF/AFC/OFC) pour Globe Trotter & co. ──
const CONTINENT: Record<string, string> = {};
const _c = (list: string[], cont: string) => list.forEach((n) => (CONTINENT[n] = cont));
_c(["Allemagne", "Belgique", "Bosnie-Herzégovine", "Croatie", "Danemark", "Écosse", "Espagne", "France", "Norvège", "Pologne", "Portugal", "Roumanie", "Suisse", "République Tchèque", "Turquie", "Ukraine", "Angleterre", "Italie"], "Europe");
_c(["Argentine", "Brésil", "Chili", "Colombie", "Équateur", "Paraguay", "Uruguay"], "Amérique du Sud");
_c(["Canada", "Costa Rica", "États-Unis", "Honduras", "Mexique", "Panama"], "Amérique du Nord");
_c(["Afrique du Sud", "Algérie", "Cameroun", "Côte d'Ivoire", "Égypte", "Mali", "Maroc", "Nigeria", "Sénégal", "Tunisie", "Curaçao", "Cap-Vert", "RD Congo", "Ghana"], "Afrique");
_c(["Australie", "Corée du Sud", "Irak", "Iran", "Japon", "Oman", "Ouzbékistan", "Qatar", "Arabie Saoudite", "Jordanie"], "Asie");
_c(["Nouvelle-Zélande"], "Océanie");
const continentOf = (name: string): string | null => CONTINENT[toFrench(name)] ?? CONTINENT[name] ?? null;

const KNOCKOUT = new Set(["Huitièmes", "Quarts", "Demis", "3ème place", "Finale", "Round of 16", "Quarter-final", "Semi-final", "Final"]);
const res = (a: number, b: number) => (a > b ? "A" : b > a ? "B" : "DRAW");

interface UserAgg {
  userId: string;
  total: number; exact: number; correctResult: number; zeroPoints: number; draws: number;
  sumPoints: number; persoPoints: number; predGoals: number;
  changed: number; barPronos: number;
  invertedCount: number; decisiveResolved: number;
  maxExactStreak: number; maxZeroStreak: number;
  knockoutExact: number;
  franceMatches: number; franceWinPred: number;
  firstDayProno: boolean;
  continentsWon: Set<string>;
  teamHits: Map<string, { n: number; ok: number }>; // par sélection (spécialiste)
  quizCorrect: number;
  casinoWins: number; casinoMaxDelta: number;
  jokerTypes: Set<string>;
  babyWins: number;
  votesCount: number;
}

type PredRow = {
  user_id: string | null; predicted_score_a: number | null; predicted_score_b: number | null;
  points_awarded: number | null; created_at: string | null; updated_at: string | null;
  match: { score_a: number | null; score_b: number | null; is_settled: boolean | null; phase: string | null; team_a: string | null; team_b: string | null; starts_at: string | null } | null;
};

let CACHE: { at: number; map: Map<string, Reputation> } | null = null;
let INFLIGHT: Promise<Map<string, Reputation>> | null = null;
const TTL_MS = 120_000;

async function computeAll(): Promise<Map<string, Reputation>> {
  const supabase = createAdminClient();
  const [preds, quizzes, users, jokers, babys, members, votes, adminEmails] = await Promise.all([
    selectAll<PredRow>(supabase, "predictions", "user_id, predicted_score_a, predicted_score_b, points_awarded, created_at, updated_at, match:matches(score_a, score_b, is_settled, phase, team_a, team_b, starts_at)"),
    selectAll<{ user_id: string | null; points_awarded: number | null }>(supabase, "quiz_answers", "user_id, points_awarded"),
    selectAll<{ id: string; email: string | null }>(supabase, "users", "id, email"),
    selectAll<{ played_by_user_id: string | null; joker_type: string | null; metadata: Record<string, unknown> | null }>(supabase, "joker_plays", "played_by_user_id, joker_type, metadata"),
    selectAll<{ team_a_id: string | null; team_b_id: string | null; score_a: number | null; score_b: number | null; status: string | null }>(supabase, "babyfoot_matches", "team_a_id, team_b_id, score_a, score_b, status"),
    selectAll<{ user_id: string | null; team_id: string | null }>(supabase, "team_memberships", "user_id, team_id"),
    selectAll<{ voter_user_id: string | null }>(supabase, "votes", "voter_user_id"),
    getAdminEmails(),
  ]);

  const isAdmin = new Set(users.filter((u) => adminEmails.has((u.email ?? "").toLowerCase())).map((u) => u.id));

  // Première journée du tournoi (pour « Pionnier »).
  const settledDates = preds.map((p) => p.match?.starts_at).filter((d): d is string => !!d).sort();
  const firstDay = settledDates.length ? settledDates[0].slice(0, 10) : null;

  const agg = new Map<string, UserAgg>();
  const ensure = (id: string): UserAgg => {
    let a = agg.get(id);
    if (!a) { a = { userId: id, total: 0, exact: 0, correctResult: 0, zeroPoints: 0, draws: 0, sumPoints: 0, persoPoints: 0, predGoals: 0, changed: 0, barPronos: 0, invertedCount: 0, decisiveResolved: 0, maxExactStreak: 0, maxZeroStreak: 0, knockoutExact: 0, franceMatches: 0, franceWinPred: 0, firstDayProno: false, continentsWon: new Set(), teamHits: new Map(), quizCorrect: 0, casinoWins: 0, casinoMaxDelta: 0, jokerTypes: new Set(), babyWins: 0, votesCount: 0 }; agg.set(id, a); }
    return a;
  };

  // Prédictions ordonnées par joueur (pour les séries).
  const byUser = new Map<string, PredRow[]>();
  for (const p of preds) {
    if (!p.user_id || isAdmin.has(p.user_id)) continue;
    (byUser.get(p.user_id) ?? byUser.set(p.user_id, []).get(p.user_id)!).push(p);
  }

  for (const [uid, list] of byUser) {
    const a = ensure(uid);
    list.sort((x, y) => new Date(x.match?.starts_at ?? 0).getTime() - new Date(y.match?.starts_at ?? 0).getTime());
    let exStreak = 0, zStreak = 0;
    for (const p of list) {
      const m = p.match;
      const pa = p.predicted_score_a ?? 0, pb = p.predicted_score_b ?? 0;
      // Prono « modifié » (chambrage Foutix) — sur tous les pronos, settlé ou non.
      if (p.updated_at && p.created_at && new Date(p.updated_at).getTime() > new Date(p.created_at).getTime() + 2000) a.changed++;
      if (pa >= 3 && pb >= 3) a.barPronos++;
      if (!m || !m.is_settled || m.score_a == null || m.score_b == null) continue;
      a.total++;
      const pts = p.points_awarded ?? 0;
      a.sumPoints += pts; a.persoPoints += pts; a.predGoals += pa + pb;
      const exact = pa === m.score_a && pb === m.score_b;
      if (exact) { a.exact++; if (KNOCKOUT.has(m.phase ?? "")) a.knockoutExact++; }
      else if (pts > 0) a.correctResult++;
      if (pts === 0) a.zeroPoints++;
      if (pa === pb) a.draws++;
      // Séries consécutives.
      exStreak = exact ? exStreak + 1 : 0; a.maxExactStreak = Math.max(a.maxExactStreak, exStreak);
      zStreak = pts === 0 ? zStreak + 1 : 0; a.maxZeroStreak = Math.max(a.maxZeroStreak, zStreak);
      // Résultat inversé (Consultant Canal+) : on a prédit le mauvais vainqueur.
      const ar = res(m.score_a, m.score_b), pr = res(pa, pb);
      if (ar !== "DRAW" && pr !== "DRAW") { a.decisiveResolved++; if (ar !== pr) a.invertedCount++; }
      // Pionnier.
      if (firstDay && (m.starts_at ?? "").slice(0, 10) === firstDay) a.firstDayProno = true;
      // Globe Trotter : continent du vainqueur prédit correctement.
      if (pts > 0 && pr !== "DRAW") {
        const winner = pr === "A" ? m.team_a : m.team_b;
        const c = winner ? continentOf(winner) : null;
        if (c) a.continentsWon.add(c);
      }
      // Spécialiste par sélection (France/Brésil/Argentine…).
      for (const team of [m.team_a, m.team_b]) {
        if (!team) continue;
        const fr = toFrench(team);
        const h = a.teamHits.get(fr) ?? { n: 0, ok: 0 }; h.n++; if (pts > 0) h.ok++; a.teamHits.set(fr, h);
      }
      // Expert France Football : sur les matchs de la France, a-t-il prédit la France gagnante ?
      const isFranceA = toFrench(m.team_a ?? "") === "France", isFranceB = toFrench(m.team_b ?? "") === "France";
      if (isFranceA || isFranceB) { a.franceMatches++; if ((isFranceA && pr === "A") || (isFranceB && pr === "B")) a.franceWinPred++; }
    }
  }

  for (const q of quizzes) { if (!q.user_id || isAdmin.has(q.user_id)) continue; const a = ensure(q.user_id); if ((q.points_awarded ?? 0) > 0) a.quizCorrect++; }
  for (const j of jokers) {
    if (!j.played_by_user_id || isAdmin.has(j.played_by_user_id)) continue;
    const a = ensure(j.played_by_user_id); if (j.joker_type) a.jokerTypes.add(j.joker_type);
    if (j.joker_type === "casino") { const d = Number((j.metadata as { points_delta?: unknown } | null)?.points_delta ?? 0); if (d > 0) { a.casinoWins++; a.casinoMaxDelta = Math.max(a.casinoMaxDelta, d); } }
  }
  // Babyfoot : victoires de l'équipe du joueur.
  const teamsOfUser = new Map<string, Set<string>>();
  for (const m of members) { if (!m.user_id || !m.team_id || isAdmin.has(m.user_id)) continue; (teamsOfUser.get(m.user_id) ?? teamsOfUser.set(m.user_id, new Set()).get(m.user_id)!).add(m.team_id); }
  const winnerTeam = (b: { team_a_id: string | null; team_b_id: string | null; score_a: number | null; score_b: number | null; status: string | null }) =>
    b.status === "finished" && b.score_a != null && b.score_b != null && b.score_a !== b.score_b ? (b.score_a > b.score_b ? b.team_a_id : b.team_b_id) : null;
  const teamBabyWins = new Map<string, number>();
  for (const b of babys) { const w = winnerTeam(b); if (w) teamBabyWins.set(w, (teamBabyWins.get(w) ?? 0) + 1); }
  for (const [uid, teams] of teamsOfUser) { const a = ensure(uid); for (const t of teams) a.babyWins += teamBabyWins.get(t) ?? 0; }
  for (const v of votes) { if (!v.voter_user_id || isAdmin.has(v.voter_user_id)) continue; ensure(v.voter_user_id).votesCount++; }

  const all = [...agg.values()];

  // ── Titres ────────────────────────────────────────────────────────────────
  const titleByUser = assignTitles(all);

  // ── Badges (avec earnedCount global pour les secrets) ──────────────────────
  const userBadges = new Map<string, Badge[]>();
  const earnedCount = new Map<string, number>();
  for (const a of all) {
    const bs = badgesFor(a);
    userBadges.set(a.userId, bs);
    for (const b of bs) if (b.earned) earnedCount.set(b.key, (earnedCount.get(b.key) ?? 0) + 1);
  }

  const result = new Map<string, Reputation>();
  for (const a of all) {
    const badges = userBadges.get(a.userId)!.map((b) => ({ ...b, earnedCount: earnedCount.get(b.key) ?? 0 }));
    result.set(a.userId, { title: titleByUser.get(a.userId) ?? personalityTitle(a), badges });
  }
  return result;
}

function best(rows: UserAgg[], score: (u: UserAgg) => number): UserAgg | null {
  let top: UserAgg | null = null, bestV = -Infinity;
  for (const r of rows) { const v = score(r); if (v > bestV) { bestV = v; top = r; } }
  return top;
}

// Titres EXCLUSIFS (le leader du groupe) — par priorité d'affichage.
function assignTitles(all: UserAgg[]): Map<string, Title> {
  const T = (key: string, emoji: string, label: string, description: string): Title => ({ key, emoji, label, description, exclusive: true });
  const lbs: { t: Title; pick: () => UserAgg | null }[] = [
    { t: T("oracle", "🔮", "L'Oracle", "Plus gros total de points aux pronostics."), pick: () => best(all.filter((x) => x.total >= 5), (x) => x.sumPoints) },
    { t: T("visionnaire", "🎯", "Le Visionnaire", "Recordman de scores exacts."), pick: () => best(all.filter((x) => x.total >= 5 && x.exact >= 2), (x) => x.exact) },
    { t: T("patron", "👑", "Le Patron", "N°1 du classement perso (pronos + quiz)."), pick: () => best(all.filter((x) => x.total >= 5), (x) => x.persoPoints + x.quizCorrect) },
  ];
  const map = new Map<string, Title>();
  for (const lb of lbs) { const w = lb.pick(); if (w && !map.has(w.userId)) map.set(w.userId, lb.t); }
  return map;
}

// Titre « personnalité » = trait DOMINANT (le plus marqué), pas le premier rempli.
function personalityTitle(a: UserAgg): Title {
  const t = (key: string, emoji: string, label: string, description: string): Title => ({ key, emoji, label, description, exclusive: false });
  if (a.total < 3 && a.quizCorrect < 3) return t("recrue", "🌱", "La Recrue", "Tout juste arrivé dans l'arène.");
  const avgGoals = a.total ? a.predGoals / a.total : 0;
  const exactRate = a.total ? a.exact / a.total : 0;
  const drawRate = a.total ? a.draws / a.total : 0;
  const changeRate = a.total ? a.changed / a.total : 0;
  const jokerUse = a.jokerTypes.size + a.casinoWins;

  // Score normalisé de chaque trait → on prend le plus saillant au-dessus d'un seuil.
  const traits: { score: number; min: number; title: Title }[] = [
    { score: changeRate, min: 0.5, title: t("foutix", "🤡", "Le Foutix", "Change ses pronos sans arrêt. Indécis chronique.") },
    { score: jokerUse / 3, min: 1, title: t("flambeur", "🎲", "Le Flambeur", "Vit pour les jokers et le Casino.") },
    { score: exactRate / 0.2, min: 1, title: t("stratege", "🦅", "Le Stratège", "Un vrai flair pour le score exact.") },
    { score: drawRate / 0.4, min: 1, title: t("diplomate", "🤝", "Le Diplomate", "Voit des matchs nuls partout.") },
    { score: avgGoals / 3, min: 1, title: t("attaquant", "⚔️", "L'Attaquant", "Des pronos pleins de buts.") },
    { score: (2 - avgGoals) / 0.6, min: 1, title: t("defenseur", "🛡️", "Le Défenseur", "Des scores serrés, béton.") },
  ];
  const top = traits.filter((x) => x.score >= x.min).sort((x, y) => y.score - x.score)[0];
  if (top) return top.title;
  return t("regulier", "📊", "Le Régulier", "Toujours présent, sans extravagance.");
}

function badgesFor(a: UserAgg): Badge[] {
  const mk = (key: string, emoji: string, label: string, description: string, category: BadgeCategory, secret: boolean, current: number, target: number): Badge =>
    ({ key, emoji, label, description, category, secret, current: Math.min(current, target), target, earned: current >= target });
  const bestSpecialist = (team: string) => { const h = a.teamHits.get(team); return h && h.n >= 3 ? h.ok / h.n : 0; };
  return [
    // 🏆 Prestige
    mk("prophete", "🔮", "Le Prophète", "3 scores exacts de suite.", "prestige", false, a.maxExactStreak, 3),
    mk("oeil_faucon", "🦅", "L'Œil de Faucon", "10 scores exacts.", "prestige", false, a.exact, 10),
    mk("tireur_elite", "🎯", "Tireur d'élite", "5 scores exacts.", "prestige", false, a.exact, 5),
    mk("warren_buffet", "💰", "Warren Buffet", "Gagner 3 fois au Casino.", "prestige", false, a.casinoWins, 3),
    // 🤡 Humour / chambrage (négatifs assumables)
    mk("chat_noir", "💀", "Le Chat Noir", "5 matchs de suite à 0 point.", "humour", false, a.maxZeroStreak, 5),
    mk("consultant", "🚑", "Le Consultant Canal+", "Se tromper de vainqueur dans 50 % des cas (min. 8 matchs décisifs).", "humour", false, a.decisiveResolved >= 8 && a.invertedCount / Math.max(1, a.decisiveResolved) >= 0.5 ? 1 : 0, 1),
    mk("foutix", "🤷", "Le Foutix", "Modifier plus de 50 % de ses pronos (min. 8).", "humour", false, a.total >= 8 && a.changed / Math.max(1, a.total) >= 0.5 ? 1 : 0, 1),
    mk("bar", "🍺", "Le Pronostiqueur du Bar", "4 pronos à 3-3 ou plus.", "humour", false, a.barPronos, 4),
    mk("expert_france", "🥖", "L'Expert France Football", "Prédire la France gagnante à chacun de ses matchs (min. 3).", "humour", false, a.franceMatches >= 3 && a.franceWinPred === a.franceMatches ? 1 : 0, 1),
    // ⚽ Culture football
    mk("globe_trotter", "🌎", "Globe Trotter", "Un bon prono de victoire sur 5 continents.", "culture", false, a.continentsWon.size, 5),
    mk("spe_bresil", "🇧🇷", "Spécialiste Brésil", "80 % de réussite sur les matchs du Brésil (min. 3).", "culture", false, bestSpecialist("Brésil") >= 0.8 ? 1 : 0, 1),
    mk("spe_argentine", "🇦🇷", "Spécialiste Argentine", "80 % de réussite sur les matchs de l'Argentine (min. 3).", "culture", false, bestSpecialist("Argentine") >= 0.8 ? 1 : 0, 1),
    mk("spe_bleus", "🇫🇷", "Spécialiste Bleus", "80 % de réussite sur les matchs de la France (min. 3).", "culture", false, bestSpecialist("France") >= 0.8 ? 1 : 0, 1),
    mk("wikipedia", "🧠", "Wikipédia du Ballon", "20 bonnes réponses au quiz.", "culture", false, a.quizCorrect, 20),
    // 🎉 Social
    mk("roi_baby", "🏓", "Le Roi du Baby", "5 victoires au babyfoot.", "social", false, a.babyWins, 5),
    mk("premier_baby", "⚽", "Première au baby", "1 victoire au babyfoot.", "social", false, a.babyWins, 1),
    mk("jury", "🗳️", "Jury du Peuple", "Voter à un concours.", "social", false, a.votesCount, 1),
    mk("pionnier", "🎂", "Pionnier", "Pronostiquer dès la 1ère journée.", "social", false, a.firstDayProno ? 1 : 0, 1),
    // 🔥 Secrets (condition cachée)
    mk("goat", "🐐", "GOAT", "???", "secret", true, a.persoPoints >= 130 ? 1 : 0, 1),
    mk("fantome", "👻", "Fantôme", "???", "secret", true, a.total >= 10 && a.changed === 0 ? 1 : 0, 1),
    mk("sorcier", "🧙", "Sorcier", "???", "secret", true, a.knockoutExact, 1),
    mk("kamikaze", "💣", "Kamikaze", "???", "secret", true, a.jokerTypes.has("kamikaze") ? 1 : 0, 1),
    mk("carton_rouge", "🚨", "Carton Rouge", "???", "secret", true, a.jokerTypes.has("carton_rouge") ? 1 : 0, 1),
    mk("high_roller", "🎰", "High Roller", "???", "secret", true, a.casinoMaxDelta >= 30 ? 1 : 0, 1),
  ];
}

export async function getReputationMap(): Promise<Map<string, Reputation>> {
  if (CACHE && Date.now() - CACHE.at <= TTL_MS) return CACHE.map;
  if (!INFLIGHT) INFLIGHT = computeAll().then((map) => { CACHE = { at: Date.now(), map }; INFLIGHT = null; return map; });
  return INFLIGHT;
}

export async function getReputation(userId: string): Promise<Reputation> {
  const map = await getReputationMap();
  return map.get(userId) ?? { title: { key: "recrue", emoji: "🌱", label: "La Recrue", description: "Tout juste arrivé dans l'arène.", exclusive: false }, badges: [] };
}
