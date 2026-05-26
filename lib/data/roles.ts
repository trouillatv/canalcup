import { createAdminClient } from "@/lib/supabase/admin";

// Emails des organisateurs (admin + super_admin) — exclus des CLASSEMENTS
// (ce ne sont pas des compétiteurs). Lecture via service_role : allowlist_users
// n'est pas lisible avec le client session. event_admin (animateurs) reste
// inclus pour l'instant.
export async function getAdminEmails(): Promise<Set<string>> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("allowlist_users")
      .select("email, role")
      .in("role", ["admin", "super_admin"]);
    return new Set((data ?? []).map((r: { email: string }) => r.email.toLowerCase()));
  } catch {
    return new Set<string>();
  }
}
