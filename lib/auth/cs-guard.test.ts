// Tests de sécurité — garde d'accès CANAL Sports native (Lot 3D-10, voir
// lib/auth/cs-guard.ts et le plan drifting-bubbling-lamport.md §7). Même
// convention de self-skip que lib/scoring/settle.test.ts :
// SUPABASE_SERVICE_ROLE_KEY doit être une vraie clé (pas un placeholder
// TODO_) pour le projet CANAL Sports (yfhuqsuboqfznnpceosl).
//
// public.users.auth_id porte une FK réelle vers auth.users(id) ON DELETE
// CASCADE : impossible de "fabriquer" un auth_id arbitraire (constraint
// rejetée). Chaque scénario crée donc de vraies identités Supabase Auth
// jetables via admin.auth.admin.createUser(), jamais un UUID inventé.
// Toutes les lignes (public.users + auth.users) sont nettoyées dans un
// `finally`, sans jamais toucher aux 45 collaborateurs réels ni à la ligne
// admin trouillatv@gmail.com.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { ensureCanalSportsUser, requireCsAdmin } from "./cs-guard.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const keyLooksConfigured = !!key && !key.startsWith("TODO_");
const skip = !keyLooksConfigured && "SUPABASE_SERVICE_ROLE_KEY non configuree (.env.local)";
const skipAdmin =
  (!keyLooksConfigured || !anonKey) && "SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY non configurees";

const admin = keyLooksConfigured ? createClient(url!, key!, { auth: { persistSession: false } }) : null;

// Identité jetable signée pour de vrai (mot de passe temporaire), jamais un
// UUID ou un JWT fabriqué : requireCsAdmin() lit une vraie session via
// supabase.auth.getUser(), donc le test doit produire une vraie session.
async function createSignedInClient(email: string) {
  const password = `Test-${Math.random().toString(36).slice(2)}-Aa1!`;
  const { data, error } = await admin!.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { client, authId: data.user!.id };
}

async function createAuthUser(email: string): Promise<string> {
  const { data, error } = await admin!.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  return data.user!.id;
}

async function deleteAuthUser(authId: string | undefined) {
  if (!authId) return;
  await admin!.auth.admin.deleteUser(authId);
}

async function createTestUserRow(email: string, authId: string | null = null) {
  const { data, error } = await admin!
    .from("users")
    .insert({ email, name: "[TEST] cs-guard", timezone: "Pacific/Noumea", auth_id: authId })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

async function deleteTestUserRow(userRowId: string | undefined) {
  if (!userRowId) return;
  await admin!.from("users").delete().eq("id", userRowId);
}

async function readRow(userRowId: string) {
  const { data } = await admin!.from("users").select("auth_id").eq("id", userRowId).single();
  return data;
}

test(
  "ensureCanalSportsUser(): premiere connexion -> rattachement atomique auth_id <-> email",
  { skip },
  async () => {
    const email = "test-cs-guard-first-login-jest@canal-plus.com";
    let userRowId: string | undefined;
    let authId: string | undefined;
    try {
      userRowId = await createTestUserRow(email);
      authId = await createAuthUser(email);

      const result = await ensureCanalSportsUser(authId, email);
      assert.deepEqual(result, { ok: true });

      const row = await readRow(userRowId);
      assert.equal(row!.auth_id, authId);
    } finally {
      await deleteTestUserRow(userRowId);
      await deleteAuthUser(authId);
    }
  }
);

test(
  "ensureCanalSportsUser(): reconnexion -> idempotent, deja lie -> ok sans ecriture",
  { skip },
  async () => {
    const email = "test-cs-guard-reconnect-jest@canal-plus.com";
    let userRowId: string | undefined;
    let authId: string | undefined;
    try {
      authId = await createAuthUser(email);
      userRowId = await createTestUserRow(email, authId);

      const result = await ensureCanalSportsUser(authId, email);
      assert.deepEqual(result, { ok: true });

      const row = await readRow(userRowId);
      assert.equal(row!.auth_id, authId);
    } finally {
      await deleteTestUserRow(userRowId);
      await deleteAuthUser(authId);
    }
  }
);

test(
  "ensureCanalSportsUser(): email inconnu de public.users -> refuse (not_allowed)",
  { skip },
  async () => {
    const email = "test-cs-guard-unknown-jest@canal-plus.com";
    let authId: string | undefined;
    try {
      authId = await createAuthUser(email);

      const result = await ensureCanalSportsUser(authId, email);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error, "not_allowed");
    } finally {
      await deleteAuthUser(authId);
    }
  }
);

test(
  "ensureCanalSportsUser(): compte deja lie a un AUTRE auth_id -> refuse, jamais d'ecrasement (account takeover)",
  { skip },
  async () => {
    const email = "test-cs-guard-takeover-jest@canal-plus.com";
    let userRowId: string | undefined;
    let ownerAuthId: string | undefined;
    let attackerAuthId: string | undefined;
    try {
      ownerAuthId = await createAuthUser(`${email}.owner`.replace("@", "+owner@"));
      userRowId = await createTestUserRow(email, ownerAuthId);
      attackerAuthId = await createAuthUser(`${email}.attacker`.replace("@", "+attacker@"));

      const result = await ensureCanalSportsUser(attackerAuthId, email);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error, "already_linked");

      const row = await readRow(userRowId);
      assert.equal(row!.auth_id, ownerAuthId, "le rattachement d'origine ne doit jamais etre ecrase");
    } finally {
      await deleteTestUserRow(userRowId);
      await deleteAuthUser(ownerAuthId);
      await deleteAuthUser(attackerAuthId);
    }
  }
);

test(
  "ensureCanalSportsUser(): rattachement concurrent -> un seul gagnant, etat final coherent",
  { skip },
  async () => {
    const email = "test-cs-guard-race-jest@canal-plus.com";
    let userRowId: string | undefined;
    let authA: string | undefined;
    let authB: string | undefined;
    try {
      userRowId = await createTestUserRow(email);
      authA = await createAuthUser(`${email}.a`.replace("@", "+a@"));
      authB = await createAuthUser(`${email}.b`.replace("@", "+b@"));

      const [resA, resB] = await Promise.all([
        ensureCanalSportsUser(authA, email),
        ensureCanalSportsUser(authB, email),
      ]);

      const winners = [resA, resB].filter((r) => r.ok);
      const losers = [resA, resB].filter((r) => !r.ok);
      assert.equal(winners.length, 1, "exactement un appel doit reussir");
      assert.equal(losers.length, 1);
      const loser = losers[0];
      if (!loser.ok) assert.equal(loser.error, "already_linked");

      const row = await readRow(userRowId);
      assert.ok(row!.auth_id === authA || row!.auth_id === authB);
    } finally {
      await deleteTestUserRow(userRowId);
      await deleteAuthUser(authA);
      await deleteAuthUser(authB);
    }
  }
);

test(
  "ensureCanalSportsUser(): domaine non autorise -> jamais lie, meme si une ligne correspondante existe",
  { skip },
  async () => {
    const email = "test-cs-guard-domain-jest@example.invalid";
    let userRowId: string | undefined;
    let authId: string | undefined;
    try {
      userRowId = await createTestUserRow(email);
      authId = await createAuthUser(email);

      const result = await ensureCanalSportsUser(authId, email);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error, "not_allowed");

      const row = await readRow(userRowId);
      assert.equal(row!.auth_id, null, "domaine refuse -> jamais de rattachement");
    } finally {
      await deleteTestUserRow(userRowId);
      await deleteAuthUser(authId);
    }
  }
);

test(
  "requireCsAdmin(): pas de session -> 401",
  { skip: skipAdmin },
  async () => {
    const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const result = await requireCsAdmin(anon);
    assert.deepEqual(result, { ok: false, status: 401 });
  }
);

test(
  "requireCsAdmin(): utilisateur CANAL Sports normal (pas dans l'allowlist) -> 403",
  { skip: skipAdmin },
  async () => {
    const email = "test-cs-admin-normal-jest@canal-plus.com";
    let authId: string | undefined;
    try {
      const signedIn = await createSignedInClient(email);
      authId = signedIn.authId;

      const result = await requireCsAdmin(signedIn.client);
      assert.deepEqual(result, { ok: false, status: 403 });
    } finally {
      await deleteAuthUser(authId);
    }
  }
);

test(
  "requireCsAdmin(): utilisateur dans l'allowlist admin -> autorise",
  { skip: skipAdmin },
  async () => {
    const email = "test-cs-admin-authorized-jest@canal-plus.com";
    const previousAdminEmails = process.env.ADMIN_EMAILS;
    let authId: string | undefined;
    try {
      // Allowlist temporaire pour ce test -> jamais besoin de fabriquer une
      // session pour un vrai compte admin (trouillatv@gmail.com, etc.).
      process.env.ADMIN_EMAILS = email;

      const signedIn = await createSignedInClient(email);
      authId = signedIn.authId;

      const result = await requireCsAdmin(signedIn.client);
      assert.deepEqual(result, { ok: true, email });
    } finally {
      if (previousAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = previousAdminEmails;
      await deleteAuthUser(authId);
    }
  }
);
