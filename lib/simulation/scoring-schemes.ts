// Barèmes candidats à comparer — Lot 3C, checklist point 2.
//
// IMPORTANT : aucun de ces barèmes n'est une décision. Ce fichier ne fait
// que déclarer les hypothèses de simulation demandées ; le choix se fait
// dans docs/lot3c-scoring-simulation.md après mesure, section DÉCISIONS
// RECOMMANDÉES — jamais ici.
//
// Chaque barème attribue des points à partir des faits calculés par le vrai
// scorer Lot 3B (`computeExactScoreFacts` — voir lib/predictions/scorers.ts,
// réutilisé tel quel, pas réimplémenté) : `correct_outcome`, `exact`,
// `correct_diff`. Le "bonus bonne différence" (`correctDiffPoints`) est
// explicitement une hypothèse de simulation, jamais activée dans les
// barèmes de référence demandés par Vincent — voir la variante dédiée
// `diff_bonus_hypothesis` plus bas.

export type ScoringScheme = {
  key: string;
  label: string;
  correctOutcomePoints: number;
  exactScorePoints: number; // bonus additionnel, cumulé avec correctOutcomePoints si exact
  correctDiffPoints: number; // 0 sauf hypothèse explicite
};

// Point de départ donné par Vincent (non validé) : mauvais 1N2 = 0, bon 1N2
// = 3, score exact = +2, max 5 pts/match. Ce barème EST la variante "3 + 2"
// du minimum demandé (checklist point 2) — les deux formulations désignent
// le même barème, une seule entrée est donc déclarée pour éviter un doublon
// dans le tableau comparatif.
export const BASELINE_0_3_2: ScoringScheme = {
  key: "baseline_0_3_2",
  label: "Référence Vincent = 3 + 2 (bon 1N2 = 3, exact = +2, max 5)",
  correctOutcomePoints: 3,
  exactScorePoints: 2,
  correctDiffPoints: 0,
};

export const SCHEME_2_3: ScoringScheme = {
  key: "scheme_2_3",
  label: "2 + 3 (bon résultat 2, exact +3)",
  correctOutcomePoints: 2,
  exactScorePoints: 3,
  correctDiffPoints: 0,
};

export const SCHEME_3_1: ScoringScheme = {
  key: "scheme_3_1",
  label: "3 + 1 (bon résultat 3, exact +1)",
  correctOutcomePoints: 3,
  exactScorePoints: 1,
  correctDiffPoints: 0,
};

export const SCHEME_1_3: ScoringScheme = {
  key: "scheme_1_3",
  label: "1 + 3 (bon résultat 1, exact +3)",
  correctOutcomePoints: 1,
  exactScorePoints: 3,
  correctDiffPoints: 0,
};

// Variante justifiée supplémentaire : un barème "plat" à 4+1, pour tester
// l'hypothèse produit section 5 (compréhensible, gratifiant, peu dominé par
// la chance du score exact) — poids du score exact réduit à son minimum
// (1 pt, comme 3+1) mais un socle "bon résultat" plus généreux que toutes
// les autres variantes testées, pour voir si ça améliore la permissivité
// aux absences sans écraser la discrimination.
export const SCHEME_4_1: ScoringScheme = {
  key: "scheme_4_1",
  label: "4 + 1 (bon résultat 4, exact +1, socle généreux)",
  correctOutcomePoints: 4,
  exactScorePoints: 1,
  correctDiffPoints: 0,
};

// Hypothèse de simulation uniquement (section 2 du prompt) : bonus de bonne
// différence de buts, jamais un barème candidat officiel. Basé sur 3+2 avec
// +1 additionnel si la différence de buts est correcte mais pas le score
// exact (le fait `correct_diff` est vrai pour un score exact aussi, donc on
// ne l'ajoute que si `exact` est faux pour éviter un double-comptage
// implicite — voir applyScheme ci-dessous).
export const DIFF_BONUS_HYPOTHESIS: ScoringScheme = {
  key: "diff_bonus_hypothesis",
  label: "HYPOTHÈSE : 3 + 2 + bonus bonne différence (+1, non exclusif à l'exact)",
  correctOutcomePoints: 3,
  exactScorePoints: 2,
  correctDiffPoints: 1,
};

export const ALL_SCHEMES: ScoringScheme[] = [
  BASELINE_0_3_2,
  SCHEME_2_3,
  SCHEME_3_1,
  SCHEME_1_3,
  SCHEME_4_1,
  DIFF_BONUS_HYPOTHESIS,
];

export type MatchFacts = { correct_outcome: boolean; exact: boolean; correct_diff: boolean };

export type PointBreakdown = {
  outcomePoints: number;
  exactPoints: number;
  diffPoints: number;
  total: number;
};

// Le bonus exact ne s'applique qu'en complément d'un bon 1N2 (cohérent avec
// le barème de référence de Vincent : un score exact implique
// nécessairement le bon résultat, donc jamais de bonus exact seul).
export function applyScheme(scheme: ScoringScheme, facts: MatchFacts): PointBreakdown {
  const outcomePoints = facts.correct_outcome ? scheme.correctOutcomePoints : 0;
  const exactPoints = facts.exact ? scheme.exactScorePoints : 0;
  const diffPoints = !facts.exact && facts.correct_diff ? scheme.correctDiffPoints : 0;
  return {
    outcomePoints,
    exactPoints,
    diffPoints,
    total: outcomePoints + exactPoints + diffPoints,
  };
}
