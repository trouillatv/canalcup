// Test d'intégration du verrou de clôture GLOBAL contre la vraie base CANAL
// Sports (voir lib/event/status.ts, status-core.test.ts pour la logique pure
// déjà couverte). Même convention de self-skip que lib/scoring/settle.test.ts.
//
// Risque assumé : ce test bascule pour de vrai app_settings.event_status
// (clé partagée par toute l'app) le temps de l'assertion, puis restaure
// IMMÉDIATEMENT la valeur d'origine dans un `finally` + invalide le cache.
// CANAL Sports n'a pas encore d'utilisateurs réels en prod à ce stade
// (avant Preview Vercel) — acceptable ici, mais à ne pas généraliser à un
// environnement déjà ouvert au public sans isolation supplémentaire.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { competitionLock, invalidateEventStatusCache, EVENT_STATUS_KEY } from "./status.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const keyLooksConfigured = !!key && !key.startsWith("TODO_");
const skip = !keyLooksConfigured && "SUPABASE_SERVICE_ROLE_KEY non configuree (.env.local)";

const admin = keyLooksConfigured ? createClient(url!, key!, { auth: { persistSession: false } }) : null;

async function readCurrentValue() {
  const { data } = await admin!
    .from("app_settings")
    .select("value")
    .eq("key", EVENT_STATUS_KEY)
    .maybeSingle();
  return data?.value as unknown;
}

async function restoreValue(previous: unknown) {
  if (previous === undefined) {
    await admin!.from("app_settings").delete().eq("key", EVENT_STATUS_KEY);
  } else {
    await admin!.from("app_settings").upsert({ key: EVENT_STATUS_KEY, value: previous as never });
  }
  invalidateEventStatusCache();
}

test(
  "competitionLock(): compétition fermée -> 403 competition_closed",
  { skip },
  async () => {
    const previous = await readCurrentValue();
    try {
      await admin!.from("app_settings").upsert({ key: EVENT_STATUS_KEY, value: "closed" });
      invalidateEventStatusCache();

      const locked = await competitionLock();
      assert.ok(locked, "la compétition fermée doit bloquer l'écriture");
      assert.equal(locked!.status, 403);
      const body = await locked!.json();
      assert.equal(body.error, "competition_closed");
    } finally {
      await restoreValue(previous);
    }
  }
);

test(
  "competitionLock(): compétition ouverte (clé absente) -> null, écriture autorisée",
  { skip },
  async () => {
    const previous = await readCurrentValue();
    try {
      await admin!.from("app_settings").delete().eq("key", EVENT_STATUS_KEY);
      invalidateEventStatusCache();

      const locked = await competitionLock();
      assert.equal(locked, null);
    } finally {
      await restoreValue(previous);
    }
  }
);
