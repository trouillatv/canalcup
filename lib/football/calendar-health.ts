// Santé du CALENDRIER — détecte les matchs qui manquent en base.
//
// Pourquoi : la synchro ne peut pas signaler l'absence d'un match, puisqu'elle
// n'a aucune source qui lui dise qu'il devrait exister. Le plan API-Football
// gratuit a perdu l'accès à la saison WC2026 (syncSeason crée 0 match) et la
// fenêtre TheSportsDB ne renvoie qu'une poignée d'événements : tout match hors
// de cette fenêtre n'est jamais inséré. Et ça échoue en SILENCE — « 0 match
// inséré » n'est pas une erreur, donc le cron est vert.
//
// Vécu deux fois : Argentine–Suisse (quart jamais inséré, personne n'a pu
// parier) et la finale 2026 (créée à la main la veille). On raisonne donc sur
// la STRUCTURE du tournoi, la seule chose qu'on connaisse sans source externe :
// une phase entièrement jouée doit être suivie d'une phase existante.

export interface MatchLite {
  phase: string | null;
  status: string | null;
  starts_at: string | null;
}

// Ordre d'un tournoi à élimination. 3ème place et Finale se jouent après les demies.
export const PHASE_ORDER = [
  "Groupe", "Seizièmes", "Huitièmes", "Quarts", "Demis", "3ème place", "Finale",
] as const;

export interface CalendarHealth {
  state: "ok" | "warn";
  upcoming: number;
  /** Phases attendues mais totalement absentes de la base. */
  missing: string[];
  detail: string;
}

/**
 * Alerte quand une phase est entièrement jouée alors que la phase suivante
 * n'existe pas du tout — le symptôme exact d'une synchro qui n'a rien inséré.
 * Ne dit pas QUI joue (on ne peut pas le deviner) : dit qu'il manque quelque
 * chose, et lequel, pendant qu'il est encore temps de le créer à la main.
 */
export function calendarHealth(matches: MatchLite[], now = new Date()): CalendarHealth {
  const byPhase = new Map<string, MatchLite[]>();
  for (const m of matches) {
    if (!m.phase) continue;
    byPhase.set(m.phase, [...(byPhase.get(m.phase) ?? []), m]);
  }
  const isFinished = (m: MatchLite) => m.status === "finished";
  const upcoming = matches.filter((m) => !isFinished(m) && m.starts_at && new Date(m.starts_at) > now).length;

  const missing: string[] = [];
  for (let i = 0; i < PHASE_ORDER.length - 1; i++) {
    const cur = byPhase.get(PHASE_ORDER[i]) ?? [];
    if (!cur.length || !cur.every(isFinished)) continue; // phase absente ou pas finie → rien à conclure
    // Une phase entièrement jouée : les suivantes doivent exister.
    for (const next of PHASE_ORDER.slice(i + 1)) {
      if (!(byPhase.get(next) ?? []).length) missing.push(next);
    }
    break; // la première phase terminée suffit à révéler le trou
  }

  const uniqueMissing = [...new Set(missing)];
  if (uniqueMissing.length) {
    return {
      state: "warn",
      upcoming,
      missing: uniqueMissing,
      detail: `Phase(s) absente(s) en base : ${uniqueMissing.join(", ")}. Sans la ligne, aucune carte de prono n'apparaît. Créer à la main (voir scripts/create-wc-final.js).`,
    };
  }
  if (upcoming === 0 && !(byPhase.get("Finale") ?? []).some(isFinished)) {
    return {
      state: "warn",
      upcoming: 0,
      missing: [],
      detail: "Aucun match à venir en base alors que la finale n'a pas été jouée — la synchro n'insère plus rien.",
    };
  }
  return { state: "ok", upcoming, missing: [], detail: `${upcoming} match(s) à venir en base.` };
}
