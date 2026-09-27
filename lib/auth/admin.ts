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
import { isAdminEmail } from "./admin-emails.ts";

export { isAdminEmail };

export async function isAdminRequest(req: Request): Promise<boolean> {
  // 1. Voie legacy : secret partagé (scripts, cron, automation externe).
  const headerSecret = req.headers.get("x-admin-secret");
  const envSecret = process.env.ADMIN_SECRET;
  if (envSecret && headerSecret && headerSecret === envSecret) {
    return true;
  }

  // 2. Voie utilisateur connecté : l'auth Supabase dans le cookie.
  return isAdminUser();
}

/**
 * Même liste blanche, mais depuis un Server Component (pas d'objet `Request`
 * sous la main — ex. la prévisualisation orga de la cérémonie de clôture).
 */
export async function isAdminUser(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return isAdminEmail(user?.email);
  } catch {
    return false;
  }
}
