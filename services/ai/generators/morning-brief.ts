// Générateur matinale — 1 génération/jour, stockée en base, réutilisée
// par tous. Déclenchement : cron quotidien.
//
// Mode automatique :
//   - PRÉ-TOURNOI : aucun match joué encore → prompt 'preLaunch'
//     (hype + règles + fun fact ouverture WC).
//   - EN COURS : matchs joués → prompt classique (scores de la veille
//     + classement + match du soir).

import { callGemini } from "@/services/ai/gemini";
import { PROMPTS } from "@/services/ai/prompts";
import { recordCost } from "@/services/ai/cost-tracker";

const MOCK_BRIEF = {
  title: "La nuit a livré ses verdicts — analyse matinale Canal Cup",
  body: "La nuit a été courte mais instructive. Les pronostics ont été audacieux, les résultats imprévisibles. Certaines équipes dominent avec une régularité qui commence à devenir suspecte. Le classement évolue, les égos aussi.",
  fail_of_day: "Quelqu'un a pronostiqué un score très ambitieux. Le football a dit non. La confiance était là.",
  fun_fact: "Saviez-vous que le premier match de Coupe du Monde télévisé en couleurs date de 1970 ? Depuis, les commentateurs ont eu 50 ans pour s'améliorer.",
  ai_comment: "Continuez comme ça. Le chaos organisé reste une stratégie valable.",
};

const MOCK_BRIEF_PRELAUNCH = {
  title: "J-1 — La Coupe du Monde 2026 débute demain à 06h NC",
  body: "Demain matin, ça démarre. Mexique vs Afrique du Sud à 06h heure NC, et tout le bureau a intérêt à être devant son café. Tes pronos doivent être posés AVANT le coup d'envoi, sinon t'es out pour ce match. Les équipes Canal Cup sont prêtes — toi ?",
  fail_of_day: "Astuce : pronostique avant 06h demain matin, pas après. L'API est sans pitié.",
  fun_fact: "Le premier match d'ouverture de Coupe du Monde, en 1930, a opposé la France au Mexique. La France a gagné 4-1. Depuis, on a beaucoup oublié les détails.",
  ai_comment: "Demain, ton équipe entre dans l'histoire. Ou pas. Mais elle entre.",
};

export interface MorningBriefContext {
  date: string;
  scores: string;
  leaderboard: string;
  failTeam: string;
  matchTonight: string;
  /** Si présent → mode PRÉ-TOURNOI (overrides scores/leaderboard). */
  preLaunch?: {
    matchOpener: string;
    teamsCount: number;
  };
}

export async function generateMorningBrief(ctx: MorningBriefContext) {
  const isPreLaunch = !!ctx.preLaunch;

  if (process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    return isPreLaunch ? MOCK_BRIEF_PRELAUNCH : MOCK_BRIEF;
  }

  const prompt =
    isPreLaunch && ctx.preLaunch
      ? PROMPTS.morningBriefPreLaunch({
          date: ctx.date,
          matchOpener: ctx.preLaunch.matchOpener,
          teamsCount: ctx.preLaunch.teamsCount,
        })
      : PROMPTS.morningBrief(ctx);

  const result = await callGemini<typeof MOCK_BRIEF>(prompt);
  recordCost(
    isPreLaunch ? "morning_brief_prelaunch" : "morning_brief",
    result.tokens,
    result.estimatedCostEur
  );
  return result.data;
}
