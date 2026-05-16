import { callGemini } from "@/services/ai/gemini";
import { PROMPTS } from "@/services/ai/prompts";
import { recordCost } from "@/services/ai/cost-tracker";

const MOCK_ROASTS: Record<string, string> = {
  default: "Cette équipe continue de surprendre, principalement dans le mauvais sens. Mais avec une confiance admirable.",
  "Les VARcassés": "Les VARcassés dominent. On commence à se demander s'ils ont des informations privilégiées. Le coach IA les surveille.",
  "FC Réunion Inutile": "Le FC Réunion Inutile a encore parié sur le nul. Le football a dit non. Le FC a dit merci quand même.",
  "Goal Average": "Goal Average a une vision. Ambitieuse. Pas toujours réalisée. Mais elle est là, quelque part.",
};

export async function generateRoast(teamName: string, recentResults: string): Promise<string> {
  if (process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    return MOCK_ROASTS[teamName] ?? MOCK_ROASTS.default;
  }
  const prompt = PROMPTS.teamRoast({ name: teamName, slogan: "", recentResults });
  const result = await callGemini<{ comment: string }>(prompt);
  recordCost("roast", result.tokens, result.estimatedCostEur);
  return result.data.comment ?? MOCK_ROASTS.default;
}
