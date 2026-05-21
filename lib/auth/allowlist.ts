// Helper UNIQUE pour décider si un email a le droit d'entrer dans l'app.
// Utilisé côté serveur uniquement (lit ALLOWED_EMAIL_DOMAINS non-public).
//
// Logique :
//   1. email déjà dans allowlist_users (active=true) → OK
//   2. email sur un domaine auto-autorisé → auto-insertion (role='user')
//   3. sinon → not_allowed
//
// L'auto-insertion est faite via service_role (createAdminClient) pour
// bypasser RLS — le client ne pourrait pas insérer lui-même.

import { createAdminClient } from "@/lib/supabase/admin";

export type AllowlistResult =
  | { ok: true; role: string; auto: boolean }
  | { ok: false; error: "disabled" | "not_allowed" | "insert_failed"; reason: string };

const DEFAULT_ALLOWED_DOMAINS = ["canal-plus.com"];

function getAllowedDomains(): string[] {
  const env = (process.env.ALLOWED_EMAIL_DOMAINS ?? "").trim();
  if (env.length === 0) return DEFAULT_ALLOWED_DOMAINS;
  return env.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).toLowerCase();
}

export async function ensureAllowlisted(rawEmail: string): Promise<AllowlistResult> {
  const email = rawEmail.toLowerCase();
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("allowlist_users")
    .select("is_active, role")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    if (!existing.is_active) {
      return {
        ok: false,
        error: "disabled",
        reason: "Compte désactivé par l'admin.",
      };
    }
    return { ok: true, role: existing.role, auto: false };
  }

  if (!getAllowedDomains().includes(emailDomain(email))) {
    return {
      ok: false,
      error: "not_allowed",
      reason: "Email non autorisé. Demande à un admin de t'ajouter.",
    };
  }

  const { error } = await admin
    .from("allowlist_users")
    .insert({ email, role: "user", is_active: true });
  if (error) {
    // Race : un autre process l'a inséré pendant l'INSERT.
    const { data: re } = await admin
      .from("allowlist_users")
      .select("is_active, role")
      .ilike("email", email)
      .maybeSingle();
    if (re?.is_active) return { ok: true, role: re.role, auto: false };
    return { ok: false, error: "insert_failed", reason: error.message };
  }

  return { ok: true, role: "user", auto: true };
}
