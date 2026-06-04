// Système de flash TV — alertes émotionnelles en plein écran
// Créés automatiquement par le moteur de settlement et manuellement par les admins

import { createAdminClient } from "@/lib/supabase/admin";

export type FlashType =
  | "score_exact"
  | "new_leader"
  | "hall_of_shame"
  | "fire"
  | "chaos"
  | "silence"
  | "surprise"
  | "reveal"
  | "duel_serre";

export interface TvFlash {
  id: string;
  type: FlashType;
  title: string;
  subtitle?: string;
  emoji?: string;
  created_at: string;
  expires_at: string;
}

export interface FlashConfig {
  bg: string;
  textColor: string;
  border: string;
  pulse?: boolean;
}

export const FLASH_CONFIGS: Record<FlashType, FlashConfig> = {
  score_exact: {
    bg: "from-yellow-950 to-canal-black",
    textColor: "text-canal-yellow",
    border: "border-canal-yellow/50",
  },
  new_leader: {
    bg: "from-purple-950 to-canal-black",
    textColor: "text-purple-300",
    border: "border-purple-500/40",
  },
  hall_of_shame: {
    bg: "from-red-950 to-canal-black",
    textColor: "text-red-400",
    border: "border-red-700/50",
    pulse: true,
  },
  fire: {
    bg: "from-orange-950 to-canal-black",
    textColor: "text-orange-400",
    border: "border-orange-600/40",
    pulse: true,
  },
  chaos: {
    bg: "from-red-900 to-red-950",
    textColor: "text-white",
    border: "border-red-500/60",
    pulse: true,
  },
  silence: {
    bg: "from-blue-950 to-canal-black",
    textColor: "text-blue-300",
    border: "border-blue-800/40",
  },
  surprise: {
    bg: "from-pink-950 to-canal-black",
    textColor: "text-pink-300",
    border: "border-pink-600/50",
    pulse: true,
  },
  reveal: {
    bg: "from-canal-gray-mid to-canal-black",
    textColor: "text-canal-yellow",
    border: "border-canal-yellow/30",
  },
  duel_serre: {
    bg: "from-zinc-900 to-canal-black",
    textColor: "text-white",
    border: "border-zinc-600/40",
  },
};

// Phrases atmosphériques — montrées entre les flashes quand le bureau est calme
export const ATMOSPHERIC_PHRASES: string[] = [
  "Le bureau attend. Patiemment. Enfin presque.",
  "Le Goat surveille le classement. Il ne dit rien. Mais il pense.",
  "La tension est là. Même quand tout semble calme.",
  "Quelque chose se prépare. Canal Cup ne dort jamais.",
  "Entre deux matchs, le bureau doute. C'est sain.",
  "Les pronostics sont faits. Le regret commence.",
  "Un score exact, c'est 10 points. Et beaucoup de chance. Surtout de la chance.",
  "Le classement change. Pas toujours dans le bon sens.",
  "Le Goat compile les données. Certains résultats vont faire mal.",
  "Le football est imprévisible. Les pronostics aussi. C'est tout le problème.",
];

export function getAtmosphericPhrase(): string {
  const idx = Math.floor(Date.now() / 120_000) % ATMOSPHERIC_PHRASES.length;
  return ATMOSPHERIC_PHRASES[idx];
}

export async function createFlash(
  type: FlashType,
  title: string,
  subtitle?: string,
  emoji?: string,
  expiresMinutes = 8
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const expires = new Date(Date.now() + expiresMinutes * 60_000).toISOString();
    await supabase.from("tv_flash_events").insert({
      type,
      title,
      subtitle: subtitle ?? null,
      emoji: emoji ?? null,
      expires_at: expires,
    });
  } catch (e) {
    console.error("[flash] failed to create flash", e);
  }
}
