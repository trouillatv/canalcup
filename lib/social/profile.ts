import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CurrentSocialUser = {
  authId: string;
  userId: string | null;
  email: string;
  displayName: string | null;
  teamId: string | null;
  role: string | null;
};

export async function getCurrentSocialUser(): Promise<CurrentSocialUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, display_name, name, team_id")
    .eq("auth_id", user.id)
    .maybeSingle();

  const { data: allow } = await admin
    .from("allowlist_users")
    .select("role, is_active")
    .ilike("email", user.email)
    .maybeSingle();

  if (!allow?.is_active) return null;

  return {
    authId: user.id,
    userId: profile?.id ?? null,
    email: user.email.toLowerCase(),
    displayName: profile?.display_name ?? profile?.name ?? null,
    teamId: profile?.team_id ?? null,
    role: allow.role ?? null,
  };
}

export function isSocialAdmin(user: CurrentSocialUser | null): boolean {
  return user?.role === "admin" || user?.role === "super_admin";
}
