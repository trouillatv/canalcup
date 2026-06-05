// Server-side access decision for Canal Cup.
// Existing active allowlist rows keep working. New self-allowed accounts must
// use the required Canal+ email domain.

import { isRequiredEmailDomain, normalizeEmail, REQUIRED_EMAIL_MESSAGE } from "@/lib/auth/email-domain";
import { createAdminClient } from "@/lib/supabase/admin";

export type AllowlistResult =
  | { ok: true; role: string; auto: boolean }
  | { ok: false; error: "disabled" | "not_allowed" | "insert_failed"; reason: string };

export async function ensureAllowlisted(rawEmail: string): Promise<AllowlistResult> {
  const email = normalizeEmail(rawEmail);
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
        reason: "Compte desactive par l'admin.",
      };
    }
    return { ok: true, role: existing.role, auto: false };
  }

  if (!isRequiredEmailDomain(email)) {
    return {
      ok: false,
      error: "not_allowed",
      reason: REQUIRED_EMAIL_MESSAGE,
    };
  }

  const { error } = await admin
    .from("allowlist_users")
    .insert({ email, role: "user", is_active: true });

  if (error) {
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
