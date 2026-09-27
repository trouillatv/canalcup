// Garde d'accès CANAL Sports native (Lot 3D-10) — remplace ensureAllowlisted()
// / allowlist_users pour /cs/* et /api/cs/*, sans recréer cette table
// (décision P2 : voir docs/supabase-architecture-p2.md lignes 156-269).
//
// Flux : Supabase Auth authentifie (magic-link, inchangé) ; l'autorisation
// CANAL Sports s'appuie sur public.users.auth_id. Première connexion :
// rattachement contrôlé auth_id <-> email réellement authentifié, jamais
// l'inverse (le client ne choisit jamais son propre auth_id, il vient
// toujours de supabase.auth.getUser() côté serveur). Même pattern
// atomique à UPDATE unique que le settlement (ADR 0005 §4,
// lib/scoring/settle.ts) : aucun claim suivi d'un update séparé.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isRequiredEmailDomain, normalizeEmail, REQUIRED_EMAIL_MESSAGE } from "./email-domain.ts";
import { createAdminClient } from "../supabase/admin.ts";
import { isAdminEmail } from "./admin-emails.ts";

export type CanalSportsAccessResult =
  | { ok: true }
  | { ok: false; error: "not_allowed" | "already_linked"; reason: string };

export type CsAdminResult =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 403 };

/**
 * Garde admin CANAL Sports — session Supabase réelle, jamais un secret
 * partagé (voir décision produit : plus de NEXT_PUBLIC_ADMIN_SECRET pour ce
 * périmètre). Prend le client déjà résolu par l'appelant (server component ou
 * client signé en test) plutôt que d'en construire un, pour rester testable
 * sans next/headers — voir cs-guard.test.ts.
 */
export async function requireCsAdmin(supabase: SupabaseClient): Promise<CsAdminResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, status: 401 };
  if (!isAdminEmail(user.email)) return { ok: false, status: 403 };
  return { ok: true, email: user.email };
}

export async function ensureCanalSportsUser(
  authId: string,
  rawEmail: string
): Promise<CanalSportsAccessResult> {
  const admin = createAdminClient();
  const email = normalizeEmail(rawEmail);

  // Reconnexion : déjà rattaché, cas du quotidien.
  const { data: linked } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", authId)
    .maybeSingle();
  if (linked) return { ok: true };

  if (!isRequiredEmailDomain(email)) {
    return { ok: false, error: "not_allowed", reason: REQUIRED_EMAIL_MESSAGE };
  }

  // Rattachement atomique : une seule écriture, jamais de claim puis update
  // séparé. Le WHERE ferme la fenêtre de course ET empêche tout écrasement
  // d'un compte déjà lié à un autre auth_id (RLS interdit déjà ce chemin
  // côté client ; ici c'est le service role qui applique la même règle).
  const { data: claimed, error } = await admin
    .from("users")
    .update({ auth_id: authId })
    .eq("email", email)
    .is("auth_id", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (claimed) return { ok: true };

  // 0 ligne affectée : distinguer les trois causes possibles.
  const { data: existing } = await admin
    .from("users")
    .select("auth_id")
    .eq("email", email)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "not_allowed", reason: "Compte introuvable." };
  }
  if (existing.auth_id && existing.auth_id !== authId) {
    return {
      ok: false,
      error: "already_linked",
      reason: "Ce compte est deja associe a une autre identite de connexion.",
    };
  }
  // existing.auth_id === authId : rattachement concurrent, déjà gagné ailleurs.
  return { ok: true };
}
