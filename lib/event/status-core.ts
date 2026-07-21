// Cœur PUR du drapeau « Canal Cup terminée » — aucune dépendance (ni Supabase,
// ni Next), pour rester testable avec le runner natif Node (`npm test`).
//
// La source de vérité est la ligne `app_settings.key = 'event_status'`, dont la
// valeur est un jsonb libre. Selon qui l'a écrite (toggle admin, SQL à la main,
// route PATCH), on peut donc recevoir `"closed"`, `true`, `{ "status": "closed" }`…
// Un seul endroit sait interpréter tout ça : parseEventStatus.

export type EventStatus = "open" | "closed";

/** Clé unique dans `app_settings`. */
export const EVENT_STATUS_KEY = "event_status";

/** Durée du cache mémoire — un POST ne doit pas déclencher une requête à chaque fois. */
export const EVENT_STATUS_TTL_MS = 30_000;

/**
 * Interprète la valeur brute lue en base.
 *
 * Règle d'or : on ne ferme QUE sur un signal explicite de fermeture. Toute
 * valeur absente, vide, inconnue ou malformée ⇒ `open`. Fermer la compétition
 * par accident (typo en base) casserait le tournoi ; la laisser ouverte par
 * accident est rattrapable d'un clic.
 */
export function parseEventStatus(value: unknown): EventStatus {
  if (value === null || value === undefined) return "open";
  if (typeof value === "boolean") return value ? "closed" : "open";
  if (typeof value === "string") {
    const v = value.trim().toLowerCase().replace(/^"|"$/g, "");
    return v === "closed" || v === "close" || v === "true" ? "closed" : "open";
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const k of ["status", "event_status", "closed", "value"]) {
      if (k in o) return parseEventStatus(o[k]);
    }
  }
  return "open";
}

export interface EventStatusCache {
  /** Statut courant (cache court). Ne rejette jamais : voir la stratégie d'échec. */
  get(): Promise<EventStatus>;
  /** Force la relecture au prochain `get()` — appelé quand l'orga bascule le drapeau. */
  invalidate(): void;
  /** Valeur en cache sans déclencher de lecture (diagnostic / rendu synchrone). */
  peek(): EventStatus | null;
}

/**
 * Cache mémoire autour d'un lecteur asynchrone.
 *
 * Stratégie d'échec — délibérément « fail open » : si la base ne répond pas, on
 * renvoie la dernière valeur connue, sinon `open`. Un incident Supabase ne doit
 * pas geler toutes les écritures du site.
 *
 * Les lectures concurrentes partagent la même promesse (pas de stampede : 40
 * joueurs qui postent en même temps = 1 requête, pas 40).
 */
export function createEventStatusCache(
  read: () => Promise<EventStatus>,
  ttlMs: number = EVENT_STATUS_TTL_MS,
  now: () => number = () => Date.now()
): EventStatusCache {
  let cached: EventStatus | null = null;
  let expiresAt = 0;
  let inflight: Promise<EventStatus> | null = null;

  return {
    async get() {
      if (cached !== null && now() < expiresAt) return cached;
      if (inflight) return inflight;

      inflight = read().then(
        (status) => {
          cached = status;
          expiresAt = now() + ttlMs;
          inflight = null;
          return status;
        },
        () => {
          inflight = null;
          return cached ?? "open"; // fail open
        }
      );
      return inflight;
    },
    invalidate() {
      cached = null;
      expiresAt = 0;
    },
    peek() {
      return cached;
    },
  };
}
