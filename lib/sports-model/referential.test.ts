// Test d'intégration — socle référentiel Lot 1 (voir
// supabase/migrations-canal-sports/20260925000000_referential_sport_model.sql
// et docs/adr/0001-multi-sport-data-model.md).
//
// NON VALIDÉ EN LOCAL au moment de l'écriture : nécessite
// SUPABASE_SERVICE_ROLE_KEY (encore un placeholder TODO dans .env.local,
// voir docs/supabase-architecture-p2.md). Les contraintes exercées ici ont
// été vérifiées une première fois manuellement via le connecteur Supabase
// MCP (migration "lot1_constraint_verification", nettoyée après coup) —
// ce fichier permet de les revérifier localement une fois la clé configurée.
//
// Exécuter : `npm test` (une fois la clé renseignée). Le test se
// auto-skip si la clé est absente/placeholder, pour ne jamais faire
// échouer `npm test` faute de secret local.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const keyLooksConfigured = !!key && !key.startsWith("TODO_");

const admin = keyLooksConfigured ? createClient(url!, key!, { auth: { persistSession: false } }) : null;

test(
  "sports.slug est unique",
  { skip: !keyLooksConfigured && "SUPABASE_SERVICE_ROLE_KEY non configuree (.env.local)" },
  async () => {
    const { error } = await admin!.from("sports").insert({ slug: "football", name: "dup" });
    assert.ok(error, "un doublon de slug doit être rejeté");
    assert.equal(error!.code, "23505");
  }
);

test(
  "competitions.sport_id refuse une FK inexistante",
  { skip: !keyLooksConfigured && "SUPABASE_SERVICE_ROLE_KEY non configuree (.env.local)" },
  async () => {
    const { error } = await admin!
      .from("competitions")
      .insert({ sport_id: "00000000-0000-0000-0000-000000000000", slug: "ghost", name: "Ghost" });
    assert.ok(error, "une FK vers un sport inexistant doit être rejetée");
    assert.equal(error!.code, "23503");
  }
);

test(
  "event_participants refuse un doublon (event_id, participant_id) et cascade au delete de l'event",
  { skip: !keyLooksConfigured && "SUPABASE_SERVICE_ROLE_KEY non configuree (.env.local)" },
  async () => {
    const { data: sport } = await admin!
      .from("sports")
      .insert({ slug: "test-sport-jest", name: "[TEST] Sport" })
      .select("id")
      .single();
    const { data: competition } = await admin!
      .from("competitions")
      .insert({ sport_id: sport!.id, slug: "test-competition-jest", name: "[TEST] Competition" })
      .select("id")
      .single();
    const { data: season } = await admin!
      .from("seasons")
      .insert({ competition_id: competition!.id, label: "[TEST] Season" })
      .select("id")
      .single();
    const { data: event } = await admin!
      .from("events")
      .insert({ season_id: season!.id, starts_at: new Date().toISOString() })
      .select("id")
      .single();
    const { data: participant } = await admin!
      .from("participants")
      .insert({ sport_id: sport!.id, type: "team", name: "[TEST] Participant" })
      .select("id")
      .single();

    try {
      const first = await admin!
        .from("event_participants")
        .insert({ event_id: event!.id, participant_id: participant!.id, role: "home" });
      assert.equal(first.error, null);

      const dup = await admin!
        .from("event_participants")
        .insert({ event_id: event!.id, participant_id: participant!.id, role: "away" });
      assert.ok(dup.error, "un doublon (event_id, participant_id) doit être rejeté");
      assert.equal(dup.error!.code, "23505");

      await admin!.from("events").delete().eq("id", event!.id);
      const { data: remaining } = await admin!
        .from("event_participants")
        .select("id")
        .eq("event_id", event!.id);
      assert.equal(remaining?.length, 0, "on delete cascade doit vider event_participants");
    } finally {
      await admin!.from("participants").delete().eq("id", participant!.id);
      await admin!.from("seasons").delete().eq("id", season!.id);
      await admin!.from("competitions").delete().eq("id", competition!.id);
      await admin!.from("sports").delete().eq("id", sport!.id);
    }
  }
);
