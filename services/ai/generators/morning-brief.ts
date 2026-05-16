// Générateur matinale — 1 génération/jour, stockée en base, réutilisée par tous
// Déclenchement : cron quotidien (app/api/cron/morning-brief/route.ts)

import { callGemini } from "@/services/ai/gemini";
import { PROMPTS } from "@/services/ai/prompts";
import { recordCost } from "@/services/ai/cost-tracker";

const MOCK_BRIEF = {
  title: "Le chaos du soir a livré ses résultats — analyse matinale",
  body: "La nuit a été courte mais instructive. Les pronostics ont été audacieux. Les résultats, imprévisibles. Le FC Réunion Inutile continue de croire très fort, ce qui est admirable. Les VARcassés dominent avec une régularité qui commence à devenir suspecte.",
  fail_of_day: "Goal Average a pronostiqué 4-0. Le score final était 0-0. La symétrie poétique ne donne pas de points.",
  fun_fact: "Saviez-vous que le premier match de Coupe du Monde télévisé en couleurs date de 1970 ? Depuis, les commentateurs ont eu 50 ans pour s'améliorer.",
  ai_comment: "Continuez comme ça. Le chaos organisé reste une stratégie valable.",
};

export interface MorningBriefContext {
  date: string;
  scores: string;
  leaderboard: string;
  failTeam: string;
  matchTonight: string;
}

export async function generateMorningBrief(ctx: MorningBriefContext) {
  if (process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    return MOCK_BRIEF;
  }

  const prompt = PROMPTS.morningBrief(ctx);
  const result = await callGemini<typeof MOCK_BRIEF>(prompt);

  recordCost("morning_brief", result.tokens, result.estimatedCostEur);

  return result.data;
}
