// Résolution de points à partir d'une règle `scoring_rules.rule` (jsonb) et
// des faits produits par un scorer (voir lib/predictions/scorers.ts). Pure,
// sans accès DB : la règle est passée en argument, jamais chargée ici — le
// caller (lib/scoring/settle.ts) est seul responsable de lire la ligne
// active en base (voir ADR 0005 section 4).
//
// Format de `rule` : tableau de clauses `{when, points}`, évaluées dans
// l'ordre — la première clause dont tous les faits de `when` correspondent
// aux faits calculés gagne. Une clause `{"when":{}}` matche donc toujours et
// sert de palier par défaut si elle est placée en dernier.

export type ScoringClause = { when: Record<string, boolean>; points: number };

export class NoMatchingScoringClauseError extends Error {
  constructor() {
    super("No clause in scoring rule matched the given facts (rule array must end with a catch-all {\"when\":{}} clause)");
    this.name = "NoMatchingScoringClauseError";
  }
}

export function resolvePoints(rule: ScoringClause[], facts: Record<string, boolean>): number {
  for (const clause of rule) {
    const matches = Object.entries(clause.when).every(([key, value]) => facts[key] === value);
    if (matches) return clause.points;
  }
  throw new NoMatchingScoringClauseError();
}
