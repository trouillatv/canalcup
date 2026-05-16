import { callGemini } from "@/services/ai/gemini";
import { recordCost } from "@/services/ai/cost-tracker";

const MOCK = [
  "Le babyfoot ne connaît pas le nul. Le score, lui, parle.",
  "On a vu des choses ce soir. Des choses qu'on ne peut pas effacer.",
  "Victoire méritée, défaite incomprise. Le babyfoot est ainsi fait.",
];

export async function generateBabyFootCommentary(teamA: string, teamB: string, scoreA: number, scoreB: number): Promise<string> {
  if (process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    return MOCK[Math.floor(Math.random() * MOCK.length)];
  }
  const winner = scoreA > scoreB ? teamA : scoreB > scoreA ? teamB : "Personne";
  const prompt = `Commentateur babyfoot Canal Cup. ${teamA} ${scoreA}-${scoreB} ${teamB}. Vainqueur: ${winner}. 1-2 phrases, sarcastique léger. Texte seul.`;
  const res = await callGemini<string>(prompt);
  recordCost("babyfoot_commentary", res.tokens, res.estimatedCostEur);
  return String(res.data);
}
