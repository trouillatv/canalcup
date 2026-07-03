// Scoring engine for Canal Cup predictions
// Rules: exact score > correct result > correct goal diff > 0

import type { Match } from "@/lib/supabase/types";

const PHASE_MULTIPLIERS: Record<string, number> = {
  // French (stored in DB)
  "Groupe": 1,
  "Seizièmes": 1, // 16es de finale (×1, identique au défaut — entrée explicite)
  "Huitièmes": 1.5,
  "Quarts": 2,
  "Demis": 2.5,
  "3ème place": 2,
  "Finale": 3,
  // English fallbacks (TheSportsDB raw values)
  "Group Stage": 1,
  "Round of 32": 1,
  "Round of 16": 1.5,
  "Quarter-final": 2,
  "Semi-final": 2.5,
  "3rd Place": 2,
  "Final": 3,
};

export type MatchResult = "A" | "DRAW" | "B";

export function getResult(scoreA: number, scoreB: number): MatchResult {
  if (scoreA > scoreB) return "A";
  if (scoreB > scoreA) return "B";
  return "DRAW";
}

export function getMultiplier(phase: string | null | undefined): number {
  return PHASE_MULTIPLIERS[phase ?? "Group Stage"] ?? 1;
}

// Score qui JUGE le prono = temps réglementaire (90' + arrêts de jeu). Règle
// phase finale : prolongation & tirs au but NE COMPTENT PAS. On lit donc
// score_reg_a/b en priorité ; fallback sur score_a/b (phase de groupes, ou
// matchs non encore re-synchronisés où score_reg n'est pas renseigné).
export function regulationScore(m: {
  score_a?: number | null;
  score_b?: number | null;
  score_reg_a?: number | null;
  score_reg_b?: number | null;
}): { a: number | null; b: number | null } {
  return {
    a: m.score_reg_a ?? m.score_a ?? null,
    b: m.score_reg_b ?? m.score_b ?? null,
  };
}

export function calculatePoints(
  match: Match,
  predictedScoreA: number,
  predictedScoreB: number
): number {
  const { a: actualA, b: actualB } = regulationScore(match);

  if (actualA === null || actualB === null) return 0;

  const multiplier = getMultiplier(match.phase);

  // Exact score
  if (predictedScoreA === actualA && predictedScoreB === actualB) {
    return Math.round(10 * multiplier);
  }

  const actualResult = getResult(actualA, actualB);
  const predictedResult = getResult(predictedScoreA, predictedScoreB);
  const actualDiff = actualA - actualB;
  const predictedDiff = predictedScoreA - predictedScoreB;

  // Correct result
  if (actualResult === predictedResult) {
    return Math.round(5 * multiplier);
  }

  // Correct goal difference (wrong result)
  if (actualDiff === predictedDiff) {
    return Math.round(3 * multiplier);
  }

  return 0;
}

// Issue d'un pronostic — MÊME logique que calculatePoints (ordre des tiers
// identique), pour la heatmap. NB : "correct_diff" est en pratique inatteignable
// (une différence de buts égale implique le même résultat → capté par
// correct_result), mais on le garde par fidélité au barème.
export type PredictionOutcome = "exact" | "correct_result" | "correct_diff" | "wrong" | "pending";

export function getPredictionOutcome(
  pred: { predicted_score_a: number | null; predicted_score_b: number | null },
  match:
    | {
        status?: string | null;
        score_a: number | null;
        score_b: number | null;
        score_reg_a?: number | null;
        score_reg_b?: number | null;
      }
    | null
    | undefined
): PredictionOutcome {
  const pa = pred.predicted_score_a;
  const pb = pred.predicted_score_b;
  if (!match) return "pending";
  if (match.status && match.status !== "finished") return "pending";
  if (pa == null || pb == null) return "pending";
  // Jugé sur le temps réglementaire (prolongation/TAB exclus en KO).
  const { a: aa, b: ab } = regulationScore(match);
  if (aa == null || ab == null) return "pending";
  if (pa === aa && pb === ab) return "exact";
  if (getResult(pa, pb) === getResult(aa, ab)) return "correct_result";
  if (pa - pb === aa - ab) return "correct_diff";
  return "wrong";
}

// Quiz Live — barème : +5 si bonne réponse en moins de 5s, +3 sinon,
// 0 si fausse réponse ou timeout. Source unique partagée client + serveur.
// Live = 15s par question (rythme salle). Solo = 10s (plus court, self-paced).
export const QUIZ_TIMER_SECONDS = 15;
export const QUIZ_SOLO_TIMER_SECONDS = 10;
export const QUIZ_FAST_THRESHOLD_MS = 5000;
// Nombre de questions tirées au hasard par session Live (on ne pose pas TOUTES
// les questions). L'organisateur peut en rajouter en cours (action "extend").
export const QUIZ_LIVE_QUESTION_COUNT = 60;

// Anti-triche / anti-précharge
// QUIZ_COUNTDOWN_MS : à chaque start/next, started_at est fixé dans le futur
// (now + countdown). Le client affiche "5… 4… 3… 2… 1…" et désactive les
// boutons pendant ce délai. Empêche d'avoir le doigt préchargé sur une lettre.
// QUIZ_MIN_RESPONSE_MS : sous ce seuil après started_at, le serveur refuse
// la réponse. Filet anti-bot / anti-clic instantané (un humain ne peut pas
// lire une question + cliquer en < 250ms).
export const QUIZ_COUNTDOWN_MS = 5000;
export const QUIZ_MIN_RESPONSE_MS = 250;

// Rythme AUTO du live (plus de clic « question suivante » : le serveur enchaîne
// tout seul). Après le chrono : court « Temps écoulé », puis la bonne réponse
// affichée quelques secondes, puis passage automatique à la question suivante.
//   [countdown] → [question 20s] → [timeup] → [stats] → [answer] → next…
export const QUIZ_TIMEUP_MS = 1200;   // « ⏱ Temps écoulé » (grise les réponses)
export const QUIZ_STATS_MS = 2200;    // répartition A/B/C/D (suspense : sans la bonne réponse)
export const QUIZ_ANSWER_MS = 4000;   // bonne réponse + courte explication + taux
// Fin du cycle d'une question : au-delà, on enchaîne automatiquement.
export const QUIZ_REVEAL_END_MS =
  QUIZ_TIMER_SECONDS * 1000 + QUIZ_TIMEUP_MS + QUIZ_STATS_MS + QUIZ_ANSWER_MS;

export function quizPoints(isCorrect: boolean, responseTimeMs: number): number {
  if (!isCorrect) return 0;
  return responseTimeMs <= QUIZ_FAST_THRESHOLD_MS ? 5 : 3;
}

// Championnat Quiz : le mode LIVE (salle, écran projeté) rapporte 100 % des
// points ; le mode SOLO (joueur seul, à distance) un pourcentage réduit —
// pour récompenser la participation à l'animation collective. Coefficient
// configurable. En Solo on N'ACCORDE PAS le bonus rapidité (pas de chrono
// serveur partagé → non triché) : bonne réponse = points de base × coefficient.
// 0,7 = le Solo rapporte 70 % des points (assez bas pour valoriser le Live,
// assez haut pour que les absents aient encore intérêt à jouer — pas punitif).
export const QUIZ_SOLO_COEFFICIENT = 0.7;

export function quizSoloPoints(isCorrect: boolean): number {
  if (!isCorrect) return 0;
  return Math.round(3 * QUIZ_SOLO_COEFFICIENT); // base (3) sans bonus rapidité, × 0,7 ≈ 2
}

// ─── Contribution du Quiz au classement GÉNÉRAL (pondérée par SCORE) ──────────
// Le CHAMPIONNAT Quiz garde les points RÉELS. Mais au classement général
// CanalCup, on n'injecte PAS les points quiz bruts (ils écraseraient le reste) :
// on les normalise entre 5 et 50 selon le SCORE quiz réel.
//   - meilleur score quiz   → QUIZ_GLOBAL_TOP (50)
//   - plus faible score parmi les PARTICIPANTS → QUIZ_GLOBAL_BOTTOM (5)
//   - les autres            → interpolation linéaire entre 5 et 50 selon le score
//   - non-participant (0 pt) → 0
// Interpolation par SCORE (pas par rang) → les ex æquo (même score) reçoivent
// automatiquement la MÊME valeur : aucune contestation possible sur une égalité.
export const QUIZ_GLOBAL_TOP = 50;
export const QUIZ_GLOBAL_BOTTOM = 5;

export function quizGlobalPoints(
  championshipByUser: Map<string, number>
): Map<string, number> {
  const out = new Map<string, number>();
  // Non-participants (0 pt quiz) → 0 au global.
  for (const [uid, pts] of championshipByUser) if ((pts ?? 0) <= 0) out.set(uid, 0);

  const participants = [...championshipByUser.entries()].filter(([, p]) => (p ?? 0) > 0);
  if (participants.length === 0) return out;

  const scores = participants.map(([, p]) => p);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  for (const [uid, p] of participants) {
    if (max === min) {
      // Tous à égalité (ou 1 seul participant) → tous au maximum.
      out.set(uid, QUIZ_GLOBAL_TOP);
      continue;
    }
    const v =
      QUIZ_GLOBAL_BOTTOM + ((p - min) / (max - min)) * (QUIZ_GLOBAL_TOP - QUIZ_GLOBAL_BOTTOM);
    out.set(uid, Math.round(v));
  }
  return out;
}

// Recalculate and update points for all predictions on a finished match
// Called by the cron after match finishes
export function scoreLabel(points: number): string {
  if (points >= 10) return "Score exact 🎯";
  if (points >= 5) return "Bon résultat ✅";
  if (points >= 3) return "Bonne différence ↔";
  return "Raté ❌";
}
