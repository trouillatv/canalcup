// Règles de comptage des buts à partir de match_events.
//
// Un événement `type = 'goal'` ne vaut PAS toujours un but au compteur :
//
//  1. "Missed Penalty" — d'anciennes synchros ont écrit les penaltys manqués en
//     type='goal' (14 lignes en base au 20/07/2026). Le transformer actuel les
//     mappe vers 'penalty_missed' (services/football/transformers.ts), mais les
//     lignes historiques restent. Un penalty manqué n'est jamais un but.
//
//  2. Les tirs au but — la séance est stockée comme une rafale de type='goal'
//     detail='Penalty' à partir de la 120e. Ils départagent les équipes mais,
//     règle FIFA, ne comptent ni au score du match ni au classement des buteurs.
//     Piège : un penalty marqué DANS LE JEU porte le même detail='Penalty'
//     (ex. Oyarzabal 22' en demi-finale) — on ne peut donc PAS filtrer sur le
//     detail seul.
//
// Discrimination retenue, purement logique : un match ne va aux tirs au but que
// si le score est à égalité à la fin de la prolongation. Donc dans un match à
// séance, AUCUN but n'a pu être inscrit à la 120e ou après — tout événement
// `goal` à partir de la 120e y est forcément un tir au but.
//
// Cette règle est volontairement indépendante du format de la minute, car la
// base en contient deux (constaté le 20/07/2026) :
//   - Suisse 0-0 Colombie   → minute=120, extra_minute=1..5
//   - Allemagne 1-1 Paraguay → minute=122..132, extra_minute=null
// Un seuil `minute > 120` ratait silencieusement la première.
//
// Sans ces règles, Suisse 0-0 Colombie remontait 10 buts et Messi était
// surcompté à 9 (vs 8 réels) au classement des buteurs.

/** Fin de la prolongation : à partir de cette minute, une séance a commencé. */
const END_OF_EXTRA_TIME = 120;

export type CountableEvent = {
  type: string;
  detail?: string | null;
  minute?: number | null;
};

/** Le match s'est-il terminé aux tirs au but ? */
export function hasShootout(match: {
  pen_a?: number | null;
  pen_b?: number | null;
}): boolean {
  return match.pen_a != null || match.pen_b != null;
}

/**
 * L'événement compte-t-il comme un but (score, classement des buteurs) ?
 *
 * `matchHasShootout` : passer le résultat de `hasShootout()` pour le match
 * concerné. Si l'info n'est pas disponible, passer `true` reste le choix
 * prudent — on n'exclut alors que les penaltys situés après la 120e.
 */
export function isCountedGoal(
  e: CountableEvent,
  matchHasShootout: boolean
): boolean {
  if (e.type !== "goal") return false;

  // Un penalty manqué n'est jamais un but, en séance comme dans le jeu.
  if (e.detail === "Missed Penalty") return false;

  // Tir au but : dans un match à séance, tout `goal` à partir de la 120e.
  if (matchHasShootout && (e.minute ?? 0) >= END_OF_EXTRA_TIME) return false;

  return true;
}

/** Le but est-il contre son camp ? (à recréditer au camp adverse) */
export function isOwnGoal(e: CountableEvent): boolean {
  return e.type === "goal" && e.detail === "Own Goal";
}
