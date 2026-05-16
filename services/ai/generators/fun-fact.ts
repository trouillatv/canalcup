import { callGemini } from "@/services/ai/gemini";
import { recordCost } from "@/services/ai/cost-tracker";

const POOL = [
  "Canal+ diffuse des matchs depuis 1984. 40 ans à regarder des penalties ratés.",
  "La CdM 2026 se joue dans 3 pays : USA, Canada, Mexique. Une première depuis 1994.",
  "Le VAR est officiel en Coupe du Monde depuis 2018. Les débats de bureau ont augmenté de 40%.",
  "Un arbitre court 10-12 km par match, sans avoir le droit de se plaindre.",
  "La CdM 1950 n'avait pas de finale. Un groupe final. L'Uruguay a gagné. Les Brésiliens pleurent encore.",
  "Saviez-vous que 'hors-jeu' s'appelait 'off side' en français jusqu'aux années 80 ? Personne ne le sait.",
];

export async function generateFunFact(used: string[] = []): Promise<string> {
  if (process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    const available = POOL.filter((f) => !used.includes(f));
    return available[Math.floor(Math.random() * available.length)] ?? POOL[0];
  }
  const prompt = `Génère une anecdote surprenante et vraie sur le football ou Canal+. Max 2 phrases. Ton Canal+, drôle, accessible non-footeux. Évite: ${used.join(" | ")}. Texte seul, pas de JSON.`;
  const result = await callGemini<string>(prompt);
  recordCost("fun_fact", result.tokens, result.estimatedCostEur);
  return String(result.data);
}
