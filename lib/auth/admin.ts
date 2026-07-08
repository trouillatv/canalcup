// Auth admin — UNE seule fonction utilisée par tous les endpoints
// /api/admin/* : accepte SOIT le legacy secret partagé (compatibilité
// scripts/cron), SOIT que l'utilisateur Supabase connecté ait un e-mail
// dans la liste blanche ADMIN_EMAILS (par défaut : Vincent).
//
// Pourquoi : avec NEXT_PUBLIC_ADMIN_SECRET, le secret côté client se
// retrouve compilé dans le JS du navigateur — peu sécurisé ET fragile
// si la var n'est pas définie (un "" → unauthorized partout).
// Avec la liste blanche e-mails, on s'appuie sur la session Supabase
// déjà présente dans les cookies du navigateur.

import { createClient } from "@/lib/supabase/server";

// Admins (co-organisateurs). trouillatv = Vincent (super_admin) ;
// marie.lucas = Marie (co-organisatrice). Le rôle event_admin en base
// (allowlist_users) ouvre les pages /admin/* ; cette liste autorise les
// ACTIONS d'API (isAdminRequest). Les deux sont nécessaires.
const DEFAULT_ADMIN_EMAILS = ["trouillatv@gmail.com", "vincent.trouillat@canal-plus.com", "marie.lucas@canal-plus.com"];

export async function isAdminRequest(req: Request): Promise<boolean> {
  // 1. Voie legacy : secret partagé (scripts, cron, automation externe).
  const headerSecret = req.headers.get("x-admin-secret");
  const envSecret = process.env.ADMIN_SECRET;
  if (envSecret && headerSecret && headerSecret === envSecret) {
    return true;
  }

  // 2. Voie utilisateur connecté : l'auth Supabase dans le cookie.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return false;
    const allowEnv = (process.env.ADMIN_EMAILS ?? "").trim();
    const allow = (allowEnv.length > 0 ? allowEnv.split(",") : DEFAULT_ADMIN_EMAILS).map((s) =>
      s.trim().toLowerCase()
    );
    return allow.includes(user.email.toLowerCase());
  } catch {
    return false;
  }
}
