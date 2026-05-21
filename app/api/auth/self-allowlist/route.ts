// POST /api/auth/self-allowlist
//
// Endpoint appelé après signup/login pour décider si l'utilisateur a
// le droit d'accéder à l'app. Logique :
//
//   1. Si l'email est déjà dans allowlist_users + is_active → OK.
//   2. Si l'email correspond à un DOMAINE auto-autorisé (env
//      ALLOWED_EMAIL_DOMAINS, par défaut "canal-plus.com") →
//      auto-insertion dans allowlist_users (role='user') puis OK.
//   3. Sinon → 403 not_allowed.
//
// La liste des domaines est LUE CÔTÉ SERVEUR uniquement (pas
// NEXT_PUBLIC_) pour qu'un client ne puisse pas la spoofer. La table
// allowlist_users reste éditable depuis /admin/users : un admin peut
// désactiver un compte (is_active=false) → la prochaine tentative
// retombera en 403 même si l'email est sur un domaine autorisé.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_ALLOWED_DOMAINS = ["canal-plus.com"];

function getAllowedDomains(): string[] {
  const env = (process.env.ALLOWED_EMAIL_DOMAINS ?? "").trim();
  const list = env.length > 0
    ? env.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ALLOWED_DOMAINS;
  return list;
}

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).toLowerCase();
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
  }

  const email = user.email.toLowerCase();
  const admin = createAdminClient();

  // 1. Déjà dans l'allowlist ?
  const { data: existing } = await admin
    .from("allowlist_users")
    .select("is_active, role")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    if (!existing.is_active) {
      return NextResponse.json(
        { ok: false, error: "disabled", reason: "Compte désactivé par l'admin." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: true, role: existing.role });
  }

  // 2. Domaine auto-autorisé ?
  const domain = emailDomain(email);
  const allowed = getAllowedDomains().includes(domain);
  if (!allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_allowed",
        reason: "Email non autorisé. Demande à un admin de t'ajouter.",
      },
      { status: 403 }
    );
  }

  // 3. Auto-insertion comme simple user.
  const { error: insErr } = await admin
    .from("allowlist_users")
    .insert({ email, role: "user", is_active: true });
  if (insErr) {
    // Possible race condition (insert concurrent) : on re-tente un read.
    const { data: re } = await admin
      .from("allowlist_users")
      .select("is_active, role")
      .ilike("email", email)
      .maybeSingle();
    if (re?.is_active) return NextResponse.json({ ok: true, role: re.role });
    return NextResponse.json(
      { ok: false, error: "insert_failed", reason: insErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, role: "user", auto: true });
}
