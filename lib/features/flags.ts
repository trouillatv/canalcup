// Registre centralisé des feature flags — CANAL Sports.
//
// Contrainte du chantier P1 (fondations) : masquer un module OFF ne doit
// PAS se limiter à l'UI. Toute route API qui écrit pour un module OFF doit
// être bloquée côté serveur via requireFeature()/featureGuardResponse(),
// sinon le module continue silencieusement d'accepter des écritures en
// arrière-plan alors qu'il a disparu de la nav.
//
// États : "on" (actif), "off" (désactivé, code conservé), "prepared"
// (câblé mais pas encore activé — utile pour un sport en préparation type
// F1 avant son lancement officiel).

export type FeatureState = "on" | "off" | "prepared";

export type FeatureKey =
  // Cœur du nouveau produit
  | "predictions"
  | "briefs"
  | "program"
  | "rankings"
  | "notifications"
  // Hérité de Canal Cup — conservé en code, masqué par défaut
  | "quiz"
  | "babyfoot"
  | "jokers"
  | "social"
  | "ceremony";

export const FEATURE_REGISTRY: Readonly<Record<FeatureKey, FeatureState>> = {
  predictions: "on",
  briefs: "on",
  program: "on",
  rankings: "on",
  notifications: "on",

  quiz: "off",
  babyfoot: "off",
  jokers: "off",
  social: "off",
  ceremony: "off",
};

export function featureState(key: FeatureKey): FeatureState {
  return FEATURE_REGISTRY[key];
}

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURE_REGISTRY[key] === "on";
}

export class FeatureDisabledError extends Error {
  readonly key: FeatureKey;
  constructor(key: FeatureKey) {
    super(`Feature "${key}" is disabled`);
    this.name = "FeatureDisabledError";
    this.key = key;
  }
}

/** À utiliser en tout début d'un handler d'API route qui écrit pour un module flaggé. */
export function requireFeature(key: FeatureKey): void {
  if (!isFeatureEnabled(key)) {
    throw new FeatureDisabledError(key);
  }
}

/**
 * Variante "réponse toute prête" pour les route handlers Next.js :
 *   const blocked = featureGuardResponse("quiz");
 *   if (blocked) return blocked;
 */
export function featureGuardResponse(key: FeatureKey): Response | null {
  if (isFeatureEnabled(key)) return null;
  return Response.json(
    { error: `Feature "${key}" is disabled` },
    { status: 403 }
  );
}
