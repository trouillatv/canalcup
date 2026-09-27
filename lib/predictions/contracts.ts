// Contrats de payload pour les marchés de pronostic V1 (voir
// docs/adr/0005-prediction-engine-market-types.md, section 3). Validation
// stricte et fail-closed : un marché sans validateur enregistré ne peut
// jamais accepter de prediction, même si la ligne market_types existe en
// base. Aucune confiance dans le JSON envoyé par le client — rejet des
// clés en trop, pas d'`additionalProperties` silencieux.

export class InvalidPredictionPayloadError extends Error {
  constructor(marketCode: string, reason: string) {
    super(`Invalid payload for market "${marketCode}": ${reason}`);
    this.name = "InvalidPredictionPayloadError";
  }
}

export class UnknownMarketValidatorError extends Error {
  constructor(marketCode: string) {
    super(`No payload validator registered for market "${marketCode}"`);
    this.name = "UnknownMarketValidatorError";
  }
}

export type ExactScorePayload = { home: number; away: number };

function validateExactScore(raw: unknown): ExactScorePayload {
  if (typeof raw !== "object" || raw === null) {
    throw new InvalidPredictionPayloadError("exact_score", "payload must be an object");
  }
  const keys = Object.keys(raw);
  if (keys.length !== 2 || !keys.includes("home") || !keys.includes("away")) {
    throw new InvalidPredictionPayloadError(
      "exact_score",
      "payload must contain exactly two keys: home, away"
    );
  }
  const { home, away } = raw as Record<string, unknown>;
  for (const [label, v] of [["home", home] as const, ["away", away] as const]) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 20) {
      throw new InvalidPredictionPayloadError(
        "exact_score",
        `${label} must be an integer between 0 and 20`
      );
    }
  }
  return { home: home as number, away: away as number };
}

type PayloadValidator = (raw: unknown) => unknown;

const VALIDATORS: Record<string, PayloadValidator> = {
  exact_score: validateExactScore,
};

// Fail-closed : un market_type.code sans validateur enregistré lève une
// exception explicite — jamais un payload accepté "par défaut" parce que
// la colonne est jsonb (voir ADR 0005 section 3).
export function getValidator(marketCode: string): PayloadValidator {
  const validator = VALIDATORS[marketCode];
  if (!validator) throw new UnknownMarketValidatorError(marketCode);
  return validator;
}
