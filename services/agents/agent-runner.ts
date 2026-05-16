// Runner d'agents — déclenchement MANUEL uniquement
// Utilise Gemini Flash, stocke en base, ne relance pas si déjà en cache

import { callGemini } from "@/services/ai/gemini";
import type { AgentName, AgentReview, CommitteeResult, CommitteeSynthesis, AgentDecision } from "./index";

import { NON_FOOT_AGENT_PROMPT } from "./prompts/non-foot-agent";
import { EXPERT_FOOT_AGENT_PROMPT } from "./prompts/expert-foot-agent";
import { DISCRETE_EMPLOYEE_AGENT_PROMPT } from "./prompts/discrete-employee-agent";
import { RSE_AGENT_PROMPT } from "./prompts/rse-agent";
import { MVP_AGENT_PROMPT } from "./prompts/mvp-agent";
import { UX_MOBILE_AGENT_PROMPT } from "./prompts/ux-mobile-agent";
import { DATA_SCORING_AGENT_PROMPT } from "./prompts/data-scoring-agent";
import { MODERATION_AGENT_PROMPT } from "./prompts/moderation-agent";
import { WOW_AGENT_PROMPT } from "./prompts/wow-agent";
import { BUSINESS_SAAS_AGENT_PROMPT } from "./prompts/business-saas-agent";

const AGENT_PROMPTS: Record<AgentName, (name: string, ctx: string) => string> = {
  "non-foot": NON_FOOT_AGENT_PROMPT,
  "expert-foot": EXPERT_FOOT_AGENT_PROMPT,
  "discrete-employee": DISCRETE_EMPLOYEE_AGENT_PROMPT,
  rse: RSE_AGENT_PROMPT,
  mvp: MVP_AGENT_PROMPT,
  "ux-mobile": UX_MOBILE_AGENT_PROMPT,
  "data-scoring": DATA_SCORING_AGENT_PROMPT,
  moderation: MODERATION_AGENT_PROMPT,
  wow: WOW_AGENT_PROMPT,
  "business-saas": BUSINESS_SAAS_AGENT_PROMPT,
};

const MOCK_REVIEW: AgentReview = {
  agent_name: "Agent Mock",
  verdict_score: 7,
  strengths: ["Concept clair", "Accessible à tous"],
  concerns: ["Peut devenir complexe", "Coût IA à surveiller"],
  simplify: ["Réduire à l'essentiel pour le MVP"],
  remove: ["Toute complexité non indispensable"],
  add: ["Un mode simplifié pour les non-footeux"],
  main_risk: "Scope creep si on ajoute trop de variations",
  final_recommendation: "garder_mvp",
  philosophy: "Mode mock activé — connexion Gemini requise pour de vrais avis.",
};

export async function runAgent(
  agentName: AgentName,
  featureName: string,
  context: string
): Promise<AgentReview> {
  if (process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    return { ...MOCK_REVIEW, agent_name: `Agent ${agentName} (mock)` };
  }

  const prompt = AGENT_PROMPTS[agentName](featureName, context);
  const result = await callGemini<AgentReview>(prompt);
  return result.data;
}

export async function runCommittee(
  featureName: string,
  context: string,
  agents: AgentName[] = Object.keys(AGENT_PROMPTS) as AgentName[]
): Promise<CommitteeResult> {
  const reviews = await Promise.all(
    agents.map((name) => runAgent(name, featureName, context))
  );

  const avgScore = reviews.reduce((s, r) => s + r.verdict_score, 0) / reviews.length;

  const decisionCounts: Record<AgentDecision, number> = {
    garder_mvp: 0,
    garder_phase2: 0,
    simplifier: 0,
    supprimer: 0,
  };
  reviews.forEach((r) => {
    if (r.final_recommendation in decisionCounts) {
      decisionCounts[r.final_recommendation]++;
    }
  });

  const recommendedDecision = Object.entries(decisionCounts).sort(
    ([, a], [, b]) => b - a
  )[0][0] as AgentDecision;

  const synthesis: CommitteeSynthesis = {
    recommended_decision: recommendedDecision,
    average_score: Math.round(avgScore * 10) / 10,
    complexity_level: avgScore >= 7 ? "faible" : avgScore >= 5 ? "moyen" : "élevé",
    user_value: avgScore >= 7 ? "élevé" : avgScore >= 5 ? "moyen" : "faible",
    hr_risk: "faible",
    tech_risk: "moyen",
    estimated_ai_cost_eur: 0.02 * agents.length,
    product_priority: recommendedDecision === "garder_mvp" ? "P0" : recommendedDecision === "garder_phase2" ? "P1" : "P2",
    simplified_version: `Version simplifiée de "${featureName}" : ne garder que l'action principale, masquer les options avancées.`,
    consensus_summary: `${reviews.length} agents consultés. Score moyen ${avgScore.toFixed(1)}/10. Décision majoritaire : ${recommendedDecision}.`,
  };

  return { feature_name: featureName, reviews, synthesis };
}
