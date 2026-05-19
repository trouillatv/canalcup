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
// Calibré pour un événement « grand » (~20 actifs/équipe, nombreuses
// sessions quiz + défis). Biais volontaire : pronos haut = garde-fou
// anti-écrasement (mieux vaut surestimer le pilier dominant). Vérifiable
// via /admin/scoring (preview) — NE PLUS MODIFIER après le coup d'envoi.
export const EXPECTED_MAX_RAW: Record<Pillar, number> = {
  pronostics: 7000,
  quiz: 6000,
  babyfoot: 500,
  animations: 700,
  votes: 1, // inutilisé (poids 0) — évite la division par 0
};

// score_events n'est sommé QUE pour ces catégories (→ pilier animations).
// Toute autre catégorie est ignorée du total + warning : anti double
// comptage, car pronos/quiz/babyfoot/votes vivent dans leurs tables
// natives et ne doivent JAMAIS être recomptés via score_events.
export const SCORE_EVENT_CATEGORIES_IN_TOTAL = ["challenges", "social", "bonus"] as const;

// Plancher de PARTICIPATION : une participation à un défi/animation
// APPROUVÉE rapporte au moins ce nombre de points, même si l'admin n'en
// attribue pas — pour encourager à participer (pas que la performance).
// Levier admin pour donner 0 : ne PAS approuver (pending/hidden). Plafonné
// par le max_points du défi (un petit défi ne dépasse pas son cap). 0 =
// désactivé. Tunable comme le reste (figer avant lancement).
export const PARTICIPATION_MIN_POINTS = 5;

// ── Config résolue + override (preview/dry-run admin) ────────────────────────
// La config OFFICIELLE = DEFAULT_SCORING_CONFIG (constantes ci-dessus). Le
// preview admin passe un override (expectedMaxRaw simulé) à computeTeamScores
// SANS rien écrire : on rejoue la même fonction avec une config en mémoire.
export interface ScoringConfig {
  base: number;
  weights: Record<Pillar, number>;
  expectedMaxRaw: Record<Pillar, number>;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  base: SCORING_BASE,
  weights: PILLAR_WEIGHTS,
  expectedMaxRaw: EXPECTED_MAX_RAW,
};

export interface ScoringConfigOverride {
  base?: number;
  weights?: Partial<Record<Pillar, number>>;
  expectedMaxRaw?: Partial<Record<Pillar, number>>;
}

export function mergeScoringConfig(override?: ScoringConfigOverride): ScoringConfig {
  if (!override) return DEFAULT_SCORING_CONFIG;
  return {
    base: override.base ?? DEFAULT_SCORING_CONFIG.base,
    weights: { ...DEFAULT_SCORING_CONFIG.weights, ...(override.weights ?? {}) },
    expectedMaxRaw: {
      ...DEFAULT_SCORING_CONFIG.expectedMaxRaw,
      ...(override.expectedMaxRaw ?? {}),
    },
  };
}

export function pillarCoefficient(
  p: Pillar,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG
): number {
  const max = cfg.expectedMaxRaw[p] || 1;
  return (cfg.weights[p] * cfg.base) / max;
}

/** Contribution pondérée (entière) d'un brut pour un pilier. */
export function weightedContribution(
  p: Pillar,
  raw: number,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG
): number {
  return Math.round(pillarCoefficient(p, cfg) * raw);
}

/** Poids du pilier en % (affichage). */
export function weightPct(p: Pillar): number {
  return Math.round(PILLAR_WEIGHTS[p] * 100);
}
