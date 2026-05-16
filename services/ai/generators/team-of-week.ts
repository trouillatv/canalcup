import { callGemini } from "@/services/ai/gemini";
import { PROMPTS } from "@/services/ai/prompts";
import { recordCost } from "@/services/ai/cost-tracker";

const MOCK = {
  headline: "Une semaine de chaos organisé, comme toujours",
  story: "Les pronostics ont été audacieux. Le football, imprévisible. Le moral, étonnamment solide.",
  mvp_comment: "Les VARcassés dominent avec une aisance déconcertante. Le coach IA les surveille. Par jalousie.",
  chaos_comment: "Le FC Réunion Inutile reste fidèle à sa philosophie. Participer, c'est gagner. C'est inexact, mais c'est beau.",
};

export async function generateTeamOfWeek(ctx: { topTeam: string; topPoints: number; bottomTeam: string; bottomPoints: number; bestPrediction: string; worstPrediction: string }) {
  if (process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY) return MOCK;
  const prompt = PROMPTS.weeklyStory({
    topTeam: `${ctx.topTeam} (${ctx.topPoints}pts)`,
    bottomTeam: `${ctx.bottomTeam} (${ctx.bottomPoints}pts)`,
    bestPrediction: ctx.bestPrediction,
    worstPrediction: ctx.worstPrediction,
  });
  const result = await callGemini<typeof MOCK>(prompt);
  recordCost("team_of_week", result.tokens, result.estimatedCostEur);
  return result.data;
}
