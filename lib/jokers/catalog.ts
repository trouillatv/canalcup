// ─────────────────────────────────────────────────────────────────────────────
//  Catalogue des Jokers Canal Cup — source unique partagée client + serveur.
//  Le but produit : "se tirer dans les pattes" sans transformer Canal Cup en
//  règlement de comptes → jokers rares, limités, traçables, anti-abus.
// ─────────────────────────────────────────────────────────────────────────────

export type JokerType =
  | "casino"
  | "quitte_ou_double"
  | "carton_rouge"
  | "brouillard"
  | "espion"
  | "var"
  | "retard_avion";

export type JokerStatus = "active" | "consumed" | "expired" | "cancelled";

export type JokerEffectType =
  | "red_card_block" // Carton Rouge : le ciblé ne peut pas pronostiquer ce match
  | "fog" // Brouillard : aveugle (pronos des autres / tendances) + verrou modif 24h
  | "flight_delay" // Retard d'Avion : verrou modif des pronos existants 24h
  | "var_window" // VAR : modif autorisée jusqu'à la mi-temps sur un match
  | "spy"; // Espion : voit certains pronos futurs (max 5 consultés)

/** Comment le joker se joue : sur soi, sur un match, ou sur une cible. */
export type JokerTargeting = "self" | "self_match" | "target_match" | "target";

export interface JokerDef {
  type: JokerType;
  emoji: string;
  name: string;
  /** Description courte affichée au joueur. */
  description: string;
  /** Conditions / garde-fous lisibles. */
  conditions: string;
  targeting: JokerTargeting;
  /** Offensif = nuit à une cible → public + soumis au cooldown 10 j. */
  offensive: boolean;
  /** Durée d'effet en heures (jokers à fenêtre temporelle). */
  durationHours?: number;
}

export const JOKER_CATALOG: Record<JokerType, JokerDef> = {
  casino: {
    type: "casino",
    emoji: "🎰",
    name: "Casino",
    description: "Tente ta chance : tirage aléatoire de +15 à -10 points.",
    conditions: "Effet immédiat sur ton score perso. Pas de retour en arrière.",
    targeting: "self",
    offensive: false,
  },
  quitte_ou_double: {
    type: "quitte_ou_double",
    emoji: "💥",
    name: "Quitte ou Double",
    description: "Sur un match : score exact = +20 pts, sinon −5 pts.",
    conditions: "À jouer sur un match non commencé. Résolu à la fin du match.",
    targeting: "self_match",
    offensive: false,
  },
  carton_rouge: {
    type: "carton_rouge",
    emoji: "🚫",
    name: "Carton Rouge",
    description: "Suspend un joueur : il ne peut pas pronostiquer un match futur (0 pt).",
    conditions:
      "Match non commencé. Pas soi-même. Max 1 carton subi par joueur sur la phase de groupes.",
    targeting: "target_match",
    offensive: true,
  },
  brouillard: {
    type: "brouillard",
    emoji: "🌫",
    name: "Brouillard",
    description:
      "Pendant 24 h, la cible ne voit plus les pronos/tendances des autres et ne peut plus modifier ses pronos déjà saisis.",
    conditions: "Une seule brume active par joueur. La cible peut encore créer un prono manquant.",
    targeting: "target",
    offensive: true,
    durationHours: 24,
  },
  espion: {
    type: "espion",
    emoji: "🕵️",
    name: "Espion",
    description: "Pendant 24 h, consulte les pronos futurs des autres — 5 matchs maximum.",
    conditions: "Limité à 5 matchs consultés pendant l'effet.",
    targeting: "self",
    offensive: false,
    durationHours: 24,
  },
  var: {
    type: "var",
    emoji: "🎥",
    name: "VAR",
    description: "Sur un match : tu peux modifier ton pronostic jusqu'à la mi-temps.",
    conditions: "À jouer sur un match non terminé. Pour toi uniquement.",
    targeting: "self_match",
    offensive: false,
  },
  retard_avion: {
    type: "retard_avion",
    emoji: "✈️",
    name: "Retard d'Avion",
    description:
      "Pendant 24 h, la cible ne peut plus modifier ses pronos déjà saisis (peut encore créer un prono manquant).",
    conditions: "Un seul retard actif par joueur.",
    targeting: "target",
    offensive: true,
    durationHours: 24,
  },
};

export const ALL_JOKER_TYPES = Object.keys(JOKER_CATALOG) as JokerType[];

export function jokerDef(type: JokerType): JokerDef {
  return JOKER_CATALOG[type];
}

export function isJokerType(v: unknown): v is JokerType {
  return typeof v === "string" && v in JOKER_CATALOG;
}

// ── Garde-fous anti-acharnement ──────────────────────────────────────────────
/** Cooldown global sur les jokers OFFENSIFS joués (toutes cibles confondues). */
export const OFFENSIVE_JOKER_COOLDOWN_DAYS = 10;
/** Tirage Casino — pondéré sur ces valeurs (équiprobables pour le MVP). */
export const CASINO_OUTCOMES = [15, 10, 5, 0, -5, -10];
/** Quitte ou Double — barème. */
export const QUITTE_OU_DOUBLE_WIN = 20;
export const QUITTE_OU_DOUBLE_LOSS = -5;
/** Espion — nombre max de matchs consultables pendant l'effet. */
export const SPY_MAX_MATCHES = 5;
