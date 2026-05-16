import { callGemini } from "@/services/ai/gemini";
import { PROMPTS } from "@/services/ai/prompts";
import { recordCost } from "@/services/ai/cost-tracker";

const MOCK = [
  "Niveau confiance : 92%. Niveau précision : approximatif.",
  "Dans un univers parallèle, ce pronostic était parfait.",
  "La foi déplace des montagnes. Pas les scores.",
  "Un pronostic courageux. Le football, moins.",
];

export async function generateWallOfShameCaption(teamName: string, prediction: string, result: string): Promise<string> {
  if (process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    return MOCK[Math.floor(Math.random() * MOCK.length)];
  }
  const prompt = PROMPTS.failCaption({ teamName, prediction, result });
  const res = await callGemini<string>(prompt);
  recordCost("wall_of_shame", res.tokens, res.estimatedCostEur);
  return String(res.data);
}
