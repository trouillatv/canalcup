// Drapeau global « Canal Cup terminée » — côté serveur (Supabase + Next).
//
// Source de vérité : `app_settings.event_status` ('open' | 'closed'). Clé absente
// ⇒ ouvert. Aucune migration nécessaire (la table existe depuis migration_users_v2).
//
// Le client ne fait JAMAIS autorité : il masque les boutons pour l'UX, c'est ce
// module qui refuse réellement l'écriture (403 competition_closed).
//
// La logique pure (interprétation de la valeur + cache) vit dans ./status-core.ts,
// testée par `npm test`.

// Extension explicite requise : le package "next" n'a pas de champ "exports",
// donc la résolution ESM stricte de node --test (lib/**/*.test.ts importe ce
// fichier) exige le chemin de fichier réel, contrairement au bundler Next
// (webpack/turbopack) qui résout "next/server" sans extension dans les deux cas.
import { NextResponse } from "next/server.js";
import { createAdminClient } from "../supabase/admin.ts";
import {
  EVENT_STATUS_KEY,
  createEventStatusCache,
  parseEventStatus,
  type EventStatus,
} from "./status-core.ts";

export type { EventStatus };
export { EVENT_STATUS_KEY };

// Lecture via le client admin : toutes les routes n'ont pas de session ouverte,
// et la RLS de app_settings n'autorise la lecture qu'aux `authenticated`.
const cache = createEventStatusCache(async () => {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", EVENT_STATUS_KEY)
    .maybeSingle();
  if (error) throw error; // → le cache retombe sur la dernière valeur connue / open
  return parseEventStatus(data?.value);
});

export async function getEventStatus(): Promise<EventStatus> {
  return cache.get();
}

export async function isCompetitionClosed(): Promise<boolean> {
  return (await cache.get()) === "closed";
}

/**
 * À appeler après la bascule admin. Le cache est par instance serverless : les
 * autres instances rattrapent la bascule en ≤ 30 s (TTL). Acceptable — la
 * clôture n'est pas une opération à la seconde près.
 */
export function invalidateEventStatusCache(): void {
  cache.invalidate();
}

export const COMPETITION_CLOSED_MESSAGE =
  "La Canal Cup 2026 est terminée. Les résultats sont définitifs : plus aucune écriture n'est possible.";

/**
 * Verrou d'écriture à placer EN TÊTE de handler (juste après l'auth) :
 *
 *   const locked = await competitionLock();
 *   if (locked) return locked;
 *
 * Renvoie `null` quand la compétition est ouverte, sinon la réponse 403 à
 * retourner telle quelle.
 */
export async function competitionLock(): Promise<NextResponse | null> {
  if (!(await isCompetitionClosed())) return null;
  return NextResponse.json(
    { error: "competition_closed", message: COMPETITION_CLOSED_MESSAGE },
    { status: 403 }
  );
}
