// Suivi budget IA — objectif < 30 € pour toute la compétition

const BUDGET_EUR = 30;

export interface CostEntry {
  type: string;
  tokens: number;
  cost_eur: number;
  date: string;
}

const SESSION_COSTS: CostEntry[] = [];

export function recordCost(type: string, tokens: number, cost_eur: number) {
  SESSION_COSTS.push({ type, tokens, cost_eur, date: new Date().toISOString() });
}

export function getSessionTotal(): number {
  return SESSION_COSTS.reduce((s, e) => s + e.cost_eur, 0);
}

export function getBudgetStatus(): "safe" | "warning" | "critical" {
  const used = getSessionTotal();
  if (used < 15) return "safe";
  if (used < 25) return "warning";
  return "critical";
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  const costUsd = inputTokens * 0.000000075 + outputTokens * 0.0000003;
  return costUsd * 0.92;
}

export function getCostSummary() {
  return {
    session_total_eur: getSessionTotal(),
    budget_total_eur: BUDGET_EUR,
    budget_remaining_eur: BUDGET_EUR - getSessionTotal(),
    status: getBudgetStatus(),
    entries: SESSION_COSTS,
  };
}
