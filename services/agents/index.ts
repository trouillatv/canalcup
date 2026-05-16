// Agents IA Canal Cup — déclenchement MANUEL uniquement
// Ne jamais appeler en automatique / polling
// Utiliser avant une grosse évolution produit ou pour prioriser des features

export type AgentName =
  | "non-foot"
  | "expert-foot"
  | "discrete-employee"
  | "rse"
  | "mvp"
  | "ux-mobile"
  | "data-scoring"
  | "moderation"
  | "wow"
  | "business-saas";

export type AgentDecision =
  | "garder_mvp"
  | "garder_phase2"
  | "simplifier"
  | "supprimer";

export interface AgentReview {
  agent_name: string;
  verdict_score: number;
  strengths: string[];
  concerns: string[];
  simplify: string[];
  remove: string[];
  add: string[];
  main_risk: string;
  final_recommendation: AgentDecision;
  philosophy: string;
  [key: string]: unknown;
}

export interface CommitteeResult {
  feature_name: string;
  reviews: AgentReview[];
  synthesis: CommitteeSynthesis;
}

export interface CommitteeSynthesis {
  recommended_decision: AgentDecision;
  average_score: number;
  complexity_level: "faible" | "moyen" | "élevé";
  user_value: "faible" | "moyen" | "élevé";
  hr_risk: "faible" | "moyen" | "élevé";
  tech_risk: "faible" | "moyen" | "élevé";
  estimated_ai_cost_eur: number;
  product_priority: "P0" | "P1" | "P2" | "backlog";
  simplified_version: string;
  consensus_summary: string;
}
