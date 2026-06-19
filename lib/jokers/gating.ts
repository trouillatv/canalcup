// ─────────────────────────────────────────────────────────────────────────────
//  Gating des pronostics par les effets de jokers (serveur).
//  Utilisé par /api/predictions (création / modification) et par l'affichage
//  des tendances (masquage sous Brouillard).
// ─────────────────────────────────────────────────────────────────────────────

import { hasActiveEffect } from "@/lib/jokers/service";

/** 🚫 Carton Rouge : le joueur est-il suspendu sur ce match ? */
export async function isRedCardBlocked(userId: string, matchId: string): Promise<boolean> {
  return (await hasActiveEffect(userId, "red_card_block", matchId)) !== null;
}

/** 🎥 VAR : fenêtre de modif étendue active pour ce joueur sur ce match ? */
export async function hasVarWindow(userId: string, matchId: string): Promise<boolean> {
  return (await hasActiveEffect(userId, "var_window", matchId)) !== null;
}

/**
 * 🌫 Brouillard / ✈️ Retard d'Avion : verrou de MODIFICATION des pronos
 * existants. Renvoie un message d'erreur si verrouillé, sinon null.
 */
export async function modificationLock(userId: string): Promise<string | null> {
  if (await hasActiveEffect(userId, "fog")) {
    return "🌫 Brouillard : impossible de modifier tes pronostics pendant l'effet.";
  }
  if (await hasActiveEffect(userId, "flight_delay")) {
    return "✈️ Retard d'Avion : impossible de modifier tes pronostics pendant l'effet.";
  }
  return null;
}

/** 🌫 Brouillard : le joueur voit-il encore les pronos/tendances des autres ? */
export async function isFogged(userId: string): Promise<boolean> {
  return (await hasActiveEffect(userId, "fog")) !== null;
}
