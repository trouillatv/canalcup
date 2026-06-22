// Constantes du Mur « Moments CanalCup » (pures, client + serveur).
// Module INDÉPENDANT du concours Supporters.

export const MOMENT_CATEGORIES = [
  { key: "match",      emoji: "⚽", label: "Match" },
  { key: "supporters", emoji: "🎭", label: "Supporters" },
  { key: "animation",  emoji: "🏆", label: "Animation" },
  { key: "equipe",     emoji: "👥", label: "Équipe" },
  { key: "fun",        emoji: "🤣", label: "Fun" },
  { key: "salon",      emoji: "📺", label: "Salon TV" },
] as const;

export type MomentCategory = (typeof MOMENT_CATEGORIES)[number]["key"];
export const MOMENT_CATEGORY_KEYS: readonly string[] = MOMENT_CATEGORIES.map((c) => c.key);

export function categoryMeta(key: string): { key: string; emoji: string; label: string } {
  return MOMENT_CATEGORIES.find((c) => c.key === key) ?? { key, emoji: "📸", label: key };
}

// Réactions emoji (même esprit que le concours, mais set indépendant).
export const MOMENT_REACTIONS = ["😂", "🔥", "❤️", "⚽", "🤡"] as const;
