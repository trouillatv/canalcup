// Settlement réel Lot 3D — Architecture B / marché exact_score (voir ADR
// 0005 section 4, lignes 405-454, dont ce fichier est l'implémentation
// littérale). À NE PAS CONFONDRE avec services/scoring/settle.ts, le
// settlement Canal Cup legacy (jokers, scoring par match) : produit
// différent, table différente, ne pas réutiliser ni modifier.
//
// Pattern d'atomicité : faits + points sont calculés en pur (aucune
// écriture) avant tout accès base. La seule écriture de tout le cycle est
// un unique UPDATE `status='pending' -> 'settled'` portant à la fois
// outcome_facts et points_awarded dans la même instruction SQL — jamais de
// claim suivi d'un update séparé. Isolation par ligne (try/catch) : une
// prediction malformée n'empêche jamais le règlement des autres.

import { createAdminClient } from "../supabase/admin.ts";
import { getScorer, type EventResult } from "../predictions/scorers.ts";
import { resolvePoints, type ScoringClause } from "./rules.ts";

type PendingRow = {
  id: string;
  payload: Record<string, unknown>;
  market_type_id: string;
  market_types: { scorer_key: string } | { scorer_key: string }[];
  events: { status: string; result: EventResult } | { status: string; result: EventResult }[];
};

function one<T>(rel: T | T[]): T {
  return Array.isArray(rel) ? rel[0] : rel;
}

export type SettlementSummary = {
  settled: number;
  skippedNoActiveRule: number;
  errored: number;
};

export async function settlePendingPredictions(): Promise<SettlementSummary> {
  const admin = createAdminClient();
  const summary: SettlementSummary = { settled: 0, skippedNoActiveRule: 0, errored: 0 };

  const { data: rows, error } = await admin
    .from("predictions")
    .select(
      "id, payload, market_type_id, market_types!inner(scorer_key), events!inner(status, result)"
    )
    .eq("status", "pending")
    .eq("events.status", "finished");
  if (error) throw error;

  for (const row of (rows ?? []) as PendingRow[]) {
    try {
      const { data: ruleRow, error: ruleError } = await admin
        .from("scoring_rules")
        .select("rule")
        .eq("market_type_id", row.market_type_id)
        .eq("is_active", true)
        .maybeSingle();
      if (ruleError) throw ruleError;
      if (!ruleRow) {
        summary.skippedNoActiveRule++;
        continue; // pas de barème actif -> reste pending, aucun point deviné
      }

      const marketType = one(row.market_types);
      const event = one(row.events);
      const scorer = getScorer(marketType.scorer_key); // fail-closed
      const facts = scorer(row.payload, event.result); // pur, aucune écriture
      const points = resolvePoints(ruleRow.rule as ScoringClause[], facts); // pur, aucune écriture

      const settled = await settleOne(row.id, facts, points);
      if (settled) summary.settled++;
    } catch (err) {
      summary.errored++;
      console.error(`[settle] prediction ${row.id} laissée pending :`, err);
    }
  }

  return summary;
}

// Seule écriture du cycle : status + outcome_facts + points_awarded dans le
// même UPDATE. Le WHERE (status='pending' AND event finished) ferme la
// fenêtre de course ET rend l'appel idempotent (0 ligne affectée si déjà
// settled).
export async function settleOne(
  predictionId: string,
  facts: Record<string, boolean>,
  points: number
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("predictions")
    .update({
      status: "settled",
      outcome_facts: facts,
      points_awarded: points,
      settled_at: new Date().toISOString(),
    })
    .eq("id", predictionId)
    .eq("status", "pending")
    .select("id, events!inner(status)")
    .eq("events.status", "finished")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function voidPredictionsForCancelledEvents(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("predictions")
    .update({ status: "void", points_awarded: 0, settled_at: new Date().toISOString() })
    .eq("status", "pending")
    .eq("events.status", "cancelled")
    .select("id, events!inner(status)");
  if (error) throw error;
  return (data ?? []).length;
}
