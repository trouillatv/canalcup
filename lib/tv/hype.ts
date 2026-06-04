// Hype system — phrases, ambiance states, countdown helpers for TV mode

export type EventType =
  | "quiz" | "babyfoot" | "reveal" | "ceremony"
  | "chaos" | "duel" | "matinale" | "match_week" | "custom";

interface EventConfig {
  emoji: string;
  label: string;
  phrases: string[];
  urgentPhrases: string[];
}

export const EVENT_CONFIGS: Record<EventType, EventConfig> = {
  quiz: {
    emoji: "🧠",
    label: "QUIZ LIVE",
    phrases: [
      "Le bureau pense être prêt. Le quiz pense autrement.",
      "Quelqu'un va se découvrir une passion tardive pour le football.",
      "Les certitudes d'hier se fracassent sur les questions d'aujourd'hui.",
      "Préparez vos meilleures excuses. Juste au cas où.",
    ],
    urgentPhrases: [
      "Dernière chance de réviser. Trop tard en fait.",
      "Le quiz est impatient. Le bureau devrait l'être aussi.",
    ],
  },
  babyfoot: {
    emoji: "⚽",
    label: "BABYFOOT",
    phrases: [
      "La table de babyfoot n'attend que ses victimes.",
      "Le perdant devra justifier ses choix tactiques devant le bureau.",
      "La revanche se prépare. Le perdant aussi.",
      "Un match qui entrera dans les annales. Ou pas. Mais quand même.",
    ],
    urgentPhrases: [
      "On entend déjà la rotation des barres depuis ici.",
      "Les joueurs sont prêts. La table aussi.",
    ],
  },
  reveal: {
    emoji: "⭐",
    label: "REVEAL POINTS",
    phrases: [
      "La vérité sera cruelle pour certains. Magnifique pour d'autres.",
      "Les points ne mentent pas. Contrairement aux pronostics.",
      "Quelqu'un va grimper. Quelqu'un va descendre.",
      "Le classement s'apprête à remettre tout le monde à sa place.",
    ],
    urgentPhrases: [
      "Dans quelques minutes, on saura qui avait raison.",
      "Le bureau retient son souffle. Surtout ceux du bas du classement.",
    ],
  },
  ceremony: {
    emoji: "🏆",
    label: "CÉRÉMONIE",
    phrases: [
      "Un moment qui entrera dans les annales Canal Cup.",
      "L'histoire du bureau s'écrit maintenant.",
      "Certains moments méritent d'être vécus ensemble.",
    ],
    urgentPhrases: [
      "Le moment approche. Tout le bureau est attendu.",
      "C'est maintenant. Ou jamais. Mais maintenant c'est mieux.",
    ],
  },
  chaos: {
    emoji: "🚨",
    label: "CHAOS EVENT",
    phrases: [
      "Quelque chose d'inattendu se prépare. Canal Cup ne dort jamais.",
      "Les règles du jeu vont changer. Temporairement. Peut-être.",
      "Un événement surprise. Même Le Goat ne savait pas.",
    ],
    urgentPhrases: [
      "Le chaos arrive. Personne n'est prêt. C'est le principe.",
      "Ça commence. Le reste appartient à l'histoire.",
    ],
  },
  duel: {
    emoji: "⚔️",
    label: "DUEL D'ÉQUIPES",
    phrases: [
      "Deux équipes. Un seul vainqueur. Et beaucoup de regrets.",
      "Le duel qu'on attendait tous. Enfin presque tous.",
      "L'heure de vérité a sonné pour ces deux équipes.",
    ],
    urgentPhrases: [
      "Le duel commence. Tout le bureau regarde.",
      "Dans quelques minutes, tout bascule.",
    ],
  },
  matinale: {
    emoji: "📰",
    label: "MATINALE IA",
    phrases: [
      "Le Goat a veillé toute la nuit pour préparer ce moment.",
      "Le bureau se réveille. La matinale aussi.",
      "Le résumé de tout ce que vous avez manqué pendant votre sommeil.",
    ],
    urgentPhrases: [
      "La matinale commence. Le café peut attendre.",
      "Le Goat est prêt. Le bureau devrait l'être.",
    ],
  },
  match_week: {
    emoji: "🌟",
    label: "MATCH DE LA SEMAINE",
    phrases: [
      "Le match que tout le bureau attendait. Les pronostics sont faits.",
      "Ce soir, tout peut basculer. Dans le tournoi et dans le classement.",
      "Le rendez-vous de la semaine. Le bureau est convoqué.",
      "Ce match va faire des heureux. Et des moins heureux.",
    ],
    urgentPhrases: [
      "Le coup d'envoi approche. Les pronostics sont verrouillés.",
      "Plus le temps de changer d'avis. Le match commence.",
    ],
  },
  custom: {
    emoji: "📌",
    label: "ÉVÉNEMENT",
    phrases: [
      "Un moment Canal Cup à ne pas manquer.",
      "Le bureau est attendu. Pas d'excuse valable.",
    ],
    urgentPhrases: [
      "C'est maintenant.",
      "Tout le bureau est attendu.",
    ],
  },
};

export const AMBIANCE_STATES: Record<string, { label: string; color: string; sub: string }> = {
  "⚽": { label: "LE BUREAU EST EN MODE FOOT", color: "#F5C842", sub: "Concentration maximale" },
  "🔥": { label: "LE BUREAU EST EN FEU", color: "#FF6B35", sub: "Tensions à leur comble" },
  "😱": { label: "PANIQUE GÉNÉRALE", color: "#FF4444", sub: "Personne ne s'y attendait" },
  "🤩": { label: "LE BUREAU EST INCRÉDULE", color: "#4FC3F7", sub: "Le talent s'exprime" },
  "😡": { label: "MALAISE COLLECTIF", color: "#EF5350", sub: "Le Goat compatit. Un peu." },
  "🎉": { label: "AMBIANCE FÊTE", color: "#66BB6A", sub: "Le bureau célèbre" },
};

// ─── Pre-match Le Goat phrases ─────────────────────────────────────────────────

export interface PreMatchContext {
  teamA: string;
  teamB: string;
  topResult: "A" | "DRAW" | "B" | null;
  topPct: number;
  teamsMissing: number;
  msLeft: number;
}

export function getGoatPreMatchPhrase(ctx: PreMatchContext): string {
  const { teamA, teamB, topResult, topPct, teamsMissing, msLeft } = ctx;
  const winner = topResult === "A" ? teamA : topResult === "B" ? teamB : null;
  const mins = Math.floor(msLeft / 60_000);

  if (msLeft <= 60_000) {
    const phrases = [
      "Le Goat a verrouillé ses pronostics. C'est l'heure.",
      "Le coup d'envoi approche. Chacun assume ses choix.",
      "Dans quelques secondes, les pronostics deviennent de l'histoire.",
    ];
    return phrases[new Date().getSeconds() % phrases.length];
  }

  if (msLeft <= 5 * 60_000) {
    return `Cinq minutes. Le bureau retient son souffle. Le Goat aussi — et il retient très bien son souffle.`;
  }

  if (teamsMissing >= 2) {
    return `${teamsMissing} équipe${teamsMissing > 1 ? "s" : ""} n'ont pas encore pronostiqué. Le Goat note. Le Goat se souvient toujours.`;
  }

  if (winner && topPct >= 60) {
    return `${topPct}% du bureau croit en ${winner} ce soir. Cette confiance collective pourrait devenir un problème.`;
  }

  if (!winner) {
    return `Le bureau est divisé sur ce match. Signe que personne ne sait vraiment. Ou que tout le monde sait différemment.`;
  }

  const phrases = [
    `${teamA} contre ${teamB}. Le bureau a choisi. Reste à voir si le match est au courant.`,
    `Les pronostics commencent à sentir le drame. Bonne ou mauvaise odeur, à vous de juger.`,
    `${Math.round(mins / 5) * 5 || mins} minutes avant le coup d'envoi. Le Goat est prêt. Professionnellement parlant.`,
    `Ce match va faire des heureux. Et statistiquement, autant de déçus.`,
  ];
  return phrases[new Date().getMinutes() % phrases.length];
}

// ─── Salon atmosphérique ──────────────────────────────────────────────────────

export const SALON_PREMATCH: Record<string, string[]> = {
  far:   ["Le match approche.", "Le bureau se prépare tranquillement.", "Encore le temps d'aller chercher un café."],
  warm:  ["Le salon commence à s'échauffer.", "Les premières chaises se rapprochent de l'écran.", "L'ambiance monte doucement."],
  hot:   ["Les tensions montent.", "Personne ne pense encore à partir.", "Le bureau est aux aguets."],
  tense: ["Personne ne parle. Tout le monde regarde.", "Le silence s'installe. Le bon genre.", "Les poings se serrent."],
  event: ["Le salon est debout.", "Tout le monde est là. Même Le Goat, debout.", "C'est maintenant."],
};

export function getSalonPhrase(msLeft: number): string {
  let pool: string[];
  if (msLeft <= 60_000)        pool = SALON_PREMATCH.event;
  else if (msLeft <= 5 * 60_000)  pool = SALON_PREMATCH.tense;
  else if (msLeft <= 15 * 60_000) pool = SALON_PREMATCH.hot;
  else if (msLeft <= 30 * 60_000) pool = SALON_PREMATCH.warm;
  else                          pool = SALON_PREMATCH.far;
  return pool[new Date().getSeconds() % pool.length];
}

export const DUEL_PHRASES: Array<(gap: number, team1: string, team2: string) => string> = [
  (gap, t1, t2) => `${gap} point${gap > 1 ? "s" : ""} séparent ${t1} et ${t2}. Tout peut basculer ce soir.`,
  (gap, t1) => `${t1} tient bon. Mais ${gap} point${gap > 1 ? "s" : ""}, ça se rattrape en un match.`,
  (_gap, t1, t2) => `${t1} vs ${t2}. La rivalry dont le bureau a besoin.`,
  (gap, _t1, t2) => `${t2} est à ${gap} point${gap > 1 ? "s" : ""}. Pas rassurant. Pas impossible.`,
];

export function getHypePhrase(
  type: EventType,
  minutesLeft: number,
  customPhrase?: string | null
): string {
  if (customPhrase) return customPhrase;
  const config = EVENT_CONFIGS[type] ?? EVENT_CONFIGS.custom;
  const pool = minutesLeft <= 15 ? config.urgentPhrases : config.phrases;
  const hour = new Date().getHours();
  return pool[hour % pool.length];
}

export function getHypeLevelBadge(level: number): { label: string; colorClass: string } {
  if (level === 3) return { label: "⚡ MOMENT CLÉ", colorClass: "text-red-400" };
  if (level === 2) return { label: "🔥 HYPE ÉLEVÉE", colorClass: "text-orange-400" };
  return { label: "● À NOTER", colorClass: "text-canal-gray-muted" };
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "MAINTENANT";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  // Match à plus d'un jour : jours + heures (sinon on afficherait "50h 12min")
  if (days >= 1) {
    const hoursInDay = Math.floor((totalSec % 86400) / 3600);
    return `${days}j ${hoursInDay}h`;
  }
  if (hours >= 2) return `${hours}h ${mins.toString().padStart(2, "0")}min`;
  if (hours === 1) return `1h ${mins.toString().padStart(2, "0")}min`;
  if (mins > 0) return `${mins}:${secs.toString().padStart(2, "0")}`;
  return `0:${secs.toString().padStart(2, "0")}`;
}

export function formatNCTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-NC", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Pacific/Noumea",
  });
}
