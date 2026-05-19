// ─────────────────────────────────────────────────────────────────────────────
//  PONDÉRATION DU SCORE CANAL CUP (G2)
//
//  Modèle : normalisation par pilier + pondération produit (validé).
//    coefᵢ          = (weightᵢ × BASE) / expectedMaxRawᵢ
//    contributionᵢ  = round(coefᵢ × brutᵢ)          (par équipe)
//    total          = Σ contributionᵢ                (votes EXCLUS)
//
//  Objectif : les pronostics restent le 1er pilier (35 %) mais ne peuvent
//  PAS écraser — quiz + babyfoot + animations pèsent 65 % à eux trois. Une
//  équipe nulle au foot peut exister par le quiz, le babyfoot, les défis.
//
//  ⚠️ VALEURS À FIGER AVANT LE COUP D'ENVOI. Équité : ne plus modifier
//  pendant le tournoi (sinon « les règles changent »). Un dry-run / preview
//  admin peut servir à calibrer expectedMaxRaw AVANT lancement.
// ─────────────────────────────────────────────────────────────────────────────

export const SCORING_BASE = 1000;

export type Pillar = "pronostics" | "quiz" | "babyfoot" | "animations" | "votes";

// Parts produit validées. Somme des piliers comptés = 100 % (votes = 0).
export const PILLAR_WEIGHTS: Record<Pillar, number> = {
  pronostics: 0.35,
  quiz: 0.2,
  babyfoot: 0.2,
  animations: 0.25,
  votes: 0, // métrique SOCIALE séparée — jamais dans le score principal
};

// Max brut attendu par pilier sur TOUTE la Coupe. Unique paramètre de
// calibration — à ajuster ICI avant lancement, figé ensuite.
export const EXPECTED_MAX_RAW: Record<Pillar, number> = {
  pronostics: 3000,
  quiz: 1500,
  babyfoot: 300,
  animations: 500,
  votes: 1, // inutilisé (poids 0) — évite la division par 0
};

// score_events n'est sommé QUE pour ces catégories (→ pilier animations).
// Toute autre catégorie est ignorée du total + warning : anti double
// comptage, car pronos/quiz/babyfoot/votes vivent dans leurs tables
// natives et ne doivent JAMAIS être recomptés via score_events.
export const SCORE_EVENT_CATEGORIES_IN_TOTAL = ["challenges", "social", "bonus"] as const;

export function pillarCoefficient(p: Pillar): number {
  const max = EXPECTED_MAX_RAW[p] || 1;
  return (PILLAR_WEIGHTS[p] * SCORING_BASE) / max;
}

/** Contribution pondérée (entière) d'un brut pour un pilier. */
export function weightedContribution(p: Pillar, raw: number): number {
  return Math.round(pillarCoefficient(p) * raw);
}

/** Poids du pilier en % (affichage). */
export function weightPct(p: Pillar): number {
  return Math.round(PILLAR_WEIGHTS[p] * 100);
}
