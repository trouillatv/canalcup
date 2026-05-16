import { callGemini } from "@/services/ai/gemini";
import { recordCost } from "@/services/ai/cost-tracker";

const MOCK = [
  "Continue comme ça. La régularité dans les bons résultats, c'est aussi du talent.",
  "On y croit. Enfin, un peu. Dans les bons jours.",
  "Votre stratégie reste mystérieuse. C'est peut-être là votre force.",
  "La confiance est là. La précision viendra. Un jour.",
  "Participer c'est gagner, mais gagner c'est encore mieux. À méditer.",
];

export async function generateCoachComment(teamName: string, rank: number, points: number): Promise<string> {
  if (process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    return MOCK[Math.floor(Math.random() * MOCK.length)];
  }
  const tone = rank === 1 ? "admiration sarcastique" : rank === 3 ? "encouragement ironique" : "analyse neutre avec humour";
  const prompt = `Coach IA Canal Cup. Style Canal+, drôle, jamais humiliant. Équipe: ${teamName}, rang ${rank}e, ${points}pts. Punchline 1 phrase (ton: ${tone}). Texte seul.`;
  const result = await callGemini<string>(prompt);
  recordCost("coach_comment", result.tokens, result.estimatedCostEur);
  return String(result.data);
}
