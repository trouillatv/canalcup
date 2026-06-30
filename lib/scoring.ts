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
// 20s par question (passé de 15 → 20 pour le live show, mai 2026).
export const QUIZ_TIMER_SECONDS = 20;
export const QUIZ_FAST_THRESHOLD_MS = 5000;

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
//   [countdown] → [question 20s] → [timeup] → [answer] → next…
export const QUIZ_TIMEUP_MS = 1200;   // « ⏱ Temps écoulé » (grise les réponses)
export const QUIZ_ANSWER_MS = 4000;   // bonne réponse + courte explication
// Fin du cycle d'une question : au-delà, on enchaîne automatiquement.
export const QUIZ_REVEAL_END_MS = QUIZ_TIMER_SECONDS * 1000 + QUIZ_TIMEUP_MS + QUIZ_ANSWER_MS;

export function quizPoints(isCorrect: boolean, responseTimeMs: number): number {
  if (!isCorrect) return 0;
  return responseTimeMs <= QUIZ_FAST_THRESHOLD_MS ? 5 : 3;
}

// Championnat Quiz : le mode LIVE (salle, écran projeté) rapporte 100 % des
// points ; le mode SOLO (joueur seul, à distance) un pourcentage réduit —
// pour récompenser la participation à l'animation collective. Coefficient
// configurable. En Solo on N'ACCORDE PAS le bonus rapidité (pas de chrono
// serveur partagé → non triché) : bonne réponse = points de base × coefficient.
export const QUIZ_SOLO_COEFFICIENT = 0.5;

export function quizSoloPoints(isCorrect: boolean): number {
  if (!isCorrect) return 0;
  return Math.round(3 * QUIZ_SOLO_COEFFICIENT); // base (3) sans bonus, × coefficient
}

// Recalculate and update points for all predictions on a finished match
// Called by the cron after match finishes
export function scoreLabel(points: number): string {
  if (points >= 10) return "Score exact 🎯";
  if (points >= 5) return "Bon résultat ✅";
  if (points >= 3) return "Bonne différence ↔";
  return "Raté ❌";
}
