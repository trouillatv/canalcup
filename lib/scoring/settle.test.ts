// Tests d'intégration — settlement réel (voir lib/scoring/settle.ts, ADR
// 0005 section 4). Suit la convention de self-skip déjà en place dans
// lib/sports-model/referential.test.ts : SUPABASE_SERVICE_ROLE_KEY est
// encore un placeholder TODO dans .env.local pour le projet CANAL Sports
// (yfhuqsuboqfznnpceosl) au moment de l'écriture — ces tests s'auto-skip
// plutôt que de faire échouer `npm test` faute de secret local. À exécuter
// une fois la clé renseignée (tâche #16).
//
// Toutes les lignes créées ici portent le préfixe [TEST] / test-*-jest et
// sont nettoyées dans un `finally`, sans jamais toucher au calendrier réel
// (144 events / 288 event_participants au repos).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { settleOne, settlePendingPredictions, voidPredictionsForCancelledEvents } from "./settle.ts";
import { EVENT_STATUS_KEY, invalidateEventStatusCache } from "../event/status.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const keyLooksConfigured = !!key && !key.startsWith("TODO_");
const skip = !keyLooksConfigured && "SUPABASE_SERVICE_ROLE_KEY non configuree (.env.local)";

const admin = keyLooksConfigured ? createClient(url!, key!, { auth: { persistSession: false } }) : null;

async function buildFixture() {
  const { data: sport } = await admin!
    .from("sports")
    .insert({ slug: "test-sport-settle-jest", name: "[TEST] Sport" })
    .select("id")
    .single();
  const { data: competition } = await admin!
    .from("competitions")
    .insert({ sport_id: sport!.id, slug: "test-competition-settle-jest", name: "[TEST] Competition" })
    .select("id")
    .single();
  const { data: season } = await admin!
    .from("seasons")
    .insert({ competition_id: competition!.id, label: "[TEST] Season" })
    .select("id")
    .single();
  const { data: user } = await admin!
    .from("users")
    .insert({
      email: "test-settle-jest@example.invalid",
      name: "[TEST] User",
      timezone: "Pacific/Noumea",
    })
    .select("id")
    .single();
  const { data: exactScoreMarket } = await admin!
    .from("market_types")
    .select("id")
    .eq("code", "exact_score")
    .single();

  return { sport, competition, season, user, exactScoreMarket };
}

async function cleanupFixture(fx: Awaited<ReturnType<typeof buildFixture>>) {
  await admin!.from("users").delete().eq("id", fx.user!.id);
  await admin!.from("seasons").delete().eq("id", fx.season!.id);
  await admin!.from("competitions").delete().eq("id", fx.competition!.id);
  await admin!.from("sports").delete().eq("id", fx.sport!.id);
}

// enforce_prediction_lock() (trigger BEFORE INSERT sur predictions, tous
// rôles y compris service_role) exige un event 'scheduled' avec starts_at
// futur pour accepter l'INSERT. On crée donc toujours l'event 'scheduled'
// + futur, on insère la prediction pendant cette fenêtre, PUIS on fait
// évoluer l'event vers son état cible (finished/cancelled) via un second
// UPDATE qui ne touche jamais predictions.payload — le trigger (qui ne
// surveille qu'INSERT et UPDATE OF payload) ne se redéclenche donc pas.
async function createScheduledEvent(seasonId: string) {
  const { data: event } = await admin!
    .from("events")
    .insert({
      season_id: seasonId,
      starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status: "scheduled",
    })
    .select("id")
    .single();
  return event!.id as string;
}

async function finishEvent(eventId: string, result: Record<string, number>) {
  await admin!.from("events").update({ status: "finished", result }).eq("id", eventId);
}

async function cancelEvent(eventId: string) {
  await admin!.from("events").update({ status: "cancelled" }).eq("id", eventId);
}

async function createPrediction(
  userId: string,
  eventId: string,
  marketTypeId: string,
  payload: Record<string, number>
) {
  const { data: prediction, error } = await admin!
    .from("predictions")
    .insert({ user_id: userId, event_id: eventId, market_type_id: marketTypeId, payload })
    .select("id")
    .single();
  if (error) throw error;
  return prediction!.id as string;
}

test(
  "settleOne(): score exact sur event terminé -> settled, points 5, idempotent au second appel",
  { skip },
  async () => {
    const fx = await buildFixture();
    let eventId: string | undefined;
    let predictionId: string | undefined;
    try {
      eventId = await createScheduledEvent(fx.season!.id);
      predictionId = await createPrediction(fx.user!.id, eventId, fx.exactScoreMarket!.id, {
        home: 2,
        away: 1,
      });
      await finishEvent(eventId, { home_score: 2, away_score: 1 });

      const facts = { exact: true, correct_outcome: true, correct_diff: true };
      const firstPass = await settleOne(predictionId, facts, 5);
      assert.equal(firstPass, true, "le premier passage doit affecter la ligne");

      const { data: row } = await admin!
        .from("predictions")
        .select("status, points_awarded, outcome_facts")
        .eq("id", predictionId)
        .single();
      assert.equal(row!.status, "settled");
      assert.equal(row!.points_awarded, 5);
      assert.deepEqual(row!.outcome_facts, facts);

      const secondPass = await settleOne(predictionId, facts, 5);
      assert.equal(secondPass, false, "un event déjà settled ne doit plus jamais être réaffecté");
    } finally {
      if (predictionId) await admin!.from("predictions").delete().eq("id", predictionId);
      if (eventId) await admin!.from("events").delete().eq("id", eventId);
      await cleanupFixture(fx);
    }
  }
);

test(
  "settlePendingPredictions(): event terminé sans scoring_rules actif -> la prediction reste pending",
  { skip },
  async () => {
    const fx = await buildFixture();
    let eventId: string | undefined;
    let marketTypeId: string | undefined;
    let predictionId: string | undefined;
    try {
      // Market de test dédié, volontairement sans ligne scoring_rules
      // active, pour ne jamais dépendre du barème réel exact_score (qui,
      // lui, a une règle active — voir tâche #38).
      const { data: market } = await admin!
        .from("market_types")
        .insert({
          sport_id: fx.sport!.id,
          code: "test-no-rule-settle-jest",
          name: "[TEST] Market sans barème",
          scorer_key: "exact_score.v1",
        })
        .select("id")
        .single();
      marketTypeId = market!.id;

      eventId = await createScheduledEvent(fx.season!.id);
      predictionId = await createPrediction(fx.user!.id, eventId, marketTypeId!, { home: 0, away: 0 });
      await finishEvent(eventId, { home_score: 0, away_score: 0 });

      const summary = await settlePendingPredictions();
      assert.ok(summary.skippedNoActiveRule >= 1);

      const { data: row } = await admin!
        .from("predictions")
        .select("status, points_awarded")
        .eq("id", predictionId)
        .single();
      assert.equal(row!.status, "pending", "aucun barème actif -> aucun point deviné");
      assert.equal(row!.points_awarded, null);
    } finally {
      if (predictionId) await admin!.from("predictions").delete().eq("id", predictionId);
      if (eventId) await admin!.from("events").delete().eq("id", eventId);
      if (marketTypeId) await admin!.from("market_types").delete().eq("id", marketTypeId);
      await cleanupFixture(fx);
    }
  }
);

test(
  "settlePendingPredictions(): isole une ligne en erreur (scorer_key inconnu) sans bloquer le lot",
  { skip },
  async () => {
    const fx = await buildFixture();
    let goodEventId: string | undefined;
    let goodPredictionId: string | undefined;
    let brokenEventId: string | undefined;
    let brokenPredictionId: string | undefined;
    let brokenMarketTypeId: string | undefined;
    try {
      // Ligne saine : exact_score, règle active réelle -> doit se régler.
      goodEventId = await createScheduledEvent(fx.season!.id);
      goodPredictionId = await createPrediction(fx.user!.id, goodEventId, fx.exactScoreMarket!.id, {
        home: 1,
        away: 0,
      });

      // Ligne cassée : market_type avec un scorer_key jamais enregistré
      // dans SCORERS (lib/predictions/scorers.ts) + une règle active, pour
      // vérifier que getScorer() lève et que la ligne reste pending SANS
      // empêcher le règlement de la ligne saine ci-dessus.
      const { data: brokenMarket } = await admin!
        .from("market_types")
        .insert({
          sport_id: fx.sport!.id,
          code: "test-broken-scorer-settle-jest",
          name: "[TEST] Market scorer inconnu",
          scorer_key: "nonexistent_scorer.v1",
        })
        .select("id")
        .single();
      brokenMarketTypeId = brokenMarket!.id;
      await admin!.from("scoring_rules").insert({
        market_type_id: brokenMarketTypeId,
        is_active: true,
        rule: [{ when: {}, points: 0 }],
      });
      brokenEventId = await createScheduledEvent(fx.season!.id);
      brokenPredictionId = await createPrediction(fx.user!.id, brokenEventId, brokenMarketTypeId!, {
        home: 0,
        away: 0,
      });

      await finishEvent(goodEventId, { home_score: 1, away_score: 0 });
      await finishEvent(brokenEventId, { home_score: 0, away_score: 0 });

      const summary = await settlePendingPredictions();
      assert.ok(summary.errored >= 1);
      assert.ok(summary.settled >= 1);

      const { data: goodRow } = await admin!
        .from("predictions")
        .select("status, points_awarded")
        .eq("id", goodPredictionId)
        .single();
      assert.equal(goodRow!.status, "settled");
      assert.equal(goodRow!.points_awarded, 5);

      const { data: brokenRow } = await admin!
        .from("predictions")
        .select("status")
        .eq("id", brokenPredictionId)
        .single();
      assert.equal(brokenRow!.status, "pending", "scorer_key inconnu -> isolée, reste pending");
    } finally {
      if (goodPredictionId) await admin!.from("predictions").delete().eq("id", goodPredictionId);
      if (goodEventId) await admin!.from("events").delete().eq("id", goodEventId);
      if (brokenPredictionId) await admin!.from("predictions").delete().eq("id", brokenPredictionId);
      if (brokenEventId) await admin!.from("events").delete().eq("id", brokenEventId);
      if (brokenMarketTypeId) {
        await admin!.from("scoring_rules").delete().eq("market_type_id", brokenMarketTypeId);
        await admin!.from("market_types").delete().eq("id", brokenMarketTypeId);
      }
      await cleanupFixture(fx);
    }
  }
);

test(
  "voidPredictionsForCancelledEvents(): event annulé -> void, points 0",
  { skip },
  async () => {
    const fx = await buildFixture();
    let eventId: string | undefined;
    let predictionId: string | undefined;
    try {
      eventId = await createScheduledEvent(fx.season!.id);
      predictionId = await createPrediction(fx.user!.id, eventId, fx.exactScoreMarket!.id, {
        home: 1,
        away: 1,
      });
      await cancelEvent(eventId);

      const voided = await voidPredictionsForCancelledEvents();
      assert.ok(voided >= 1);

      const { data: row } = await admin!
        .from("predictions")
        .select("status, points_awarded")
        .eq("id", predictionId)
        .single();
      assert.equal(row!.status, "void");
      assert.equal(row!.points_awarded, 0);
    } finally {
      if (predictionId) await admin!.from("predictions").delete().eq("id", predictionId);
      if (eventId) await admin!.from("events").delete().eq("id", eventId);
      await cleanupFixture(fx);
    }
  }
);

// L'erreur PostgREST renvoyée par le client supabase-js n'est pas une
// instance d'Error (assert.rejects(..., /regex/) échouerait donc en
// comparant "[object Object]") : on capture et vérifie .message à la main,
// comme le fait déjà app/api/cs/predictions/route.ts.
async function assertPredictionLocked(userId: string, eventId: string, marketTypeId: string) {
  try {
    await createPrediction(userId, eventId, marketTypeId, { home: 0, away: 0 });
    assert.fail("l'insertion aurait dû être refusée par enforce_prediction_lock()");
  } catch (err) {
    assert.match((err as { message: string }).message, /prediction locked/);
  }
}

async function readEventStatusValue() {
  const { data } = await admin!.from("app_settings").select("value").eq("key", EVENT_STATUS_KEY).maybeSingle();
  return data?.value as unknown;
}

async function restoreEventStatusValue(previous: unknown) {
  if (previous === undefined) {
    await admin!.from("app_settings").delete().eq("key", EVENT_STATUS_KEY);
  } else {
    await admin!.from("app_settings").upsert({ key: EVENT_STATUS_KEY, value: previous as never });
  }
  invalidateEventStatusCache();
}

// Décision produit explicite : le settlement est volontairement EXEMPTÉ du
// verrou global (voir app/api/cs/admin/settle/route.ts, EXEMPTS dans
// lib/event/lock-coverage.test.ts). Ce test le prouve au niveau
// comportemental, pas seulement structurel : basculer app_settings sur
// "closed" ne doit JAMAIS empêcher settlePendingPredictions() de solder une
// prediction sur un event déjà terminé.
test(
  "settlePendingPredictions(): compétition fermée globalement -> le settlement s'exécute quand même (exemption assumée)",
  { skip },
  async () => {
    const fx = await buildFixture();
    let eventId: string | undefined;
    let predictionId: string | undefined;
    const previous = await readEventStatusValue();
    try {
      eventId = await createScheduledEvent(fx.season!.id);
      predictionId = await createPrediction(fx.user!.id, eventId, fx.exactScoreMarket!.id, {
        home: 3,
        away: 0,
      });
      await finishEvent(eventId, { home_score: 3, away_score: 0 });

      await admin!.from("app_settings").upsert({ key: EVENT_STATUS_KEY, value: "closed" });
      invalidateEventStatusCache();

      const summary = await settlePendingPredictions();
      assert.ok(summary.settled >= 1, "le settlement ne doit jamais être bloqué par la clôture globale");

      const { data: row } = await admin!
        .from("predictions")
        .select("status, points_awarded")
        .eq("id", predictionId)
        .single();
      assert.equal(row!.status, "settled");
      assert.equal(row!.points_awarded, 5);
    } finally {
      await restoreEventStatusValue(previous);
      if (predictionId) await admin!.from("predictions").delete().eq("id", predictionId);
      if (eventId) await admin!.from("events").delete().eq("id", eventId);
      await cleanupFixture(fx);
    }
  }
);

// Le verrou par coup d'envoi (trigger enforce_prediction_lock) et le verrou
// global (competitionLock/app_settings) sont deux mécanismes INDÉPENDANTS
// (voir en-tête de app/api/cs/predictions/route.ts) : ce test le prouve en
// vérifiant que le trigger refuse un event déjà commencé que le verrou
// global soit ouvert OU fermé — jamais l'un ne compense l'absence de
// l'autre.
test(
  "enforce_prediction_lock(): refuse toujours l'écriture après le coup d'envoi, que le verrou global soit ouvert ou fermé",
  { skip },
  async () => {
    const fx = await buildFixture();
    let pastEventId: string | undefined;
    const previous = await readEventStatusValue();
    try {
      const { data: event } = await admin!
        .from("events")
        .insert({
          season_id: fx.season!.id,
          starts_at: new Date(Date.now() - 60 * 1000).toISOString(),
          status: "scheduled",
        })
        .select("id")
        .single();
      pastEventId = event!.id as string;

      await admin!.from("app_settings").delete().eq("key", EVENT_STATUS_KEY);
      invalidateEventStatusCache();
      await assertPredictionLocked(fx.user!.id, pastEventId, fx.exactScoreMarket!.id);

      await admin!.from("app_settings").upsert({ key: EVENT_STATUS_KEY, value: "closed" });
      invalidateEventStatusCache();
      await assertPredictionLocked(fx.user!.id, pastEventId, fx.exactScoreMarket!.id);
    } finally {
      await restoreEventStatusValue(previous);
      if (pastEventId) await admin!.from("events").delete().eq("id", pastEventId);
      await cleanupFixture(fx);
    }
  }
);
