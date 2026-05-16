import { createClient } from "@supabase/supabase-js";

// Client service_role — serveur uniquement, jamais exposé au navigateur
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
