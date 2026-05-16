import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole, User } from "@/lib/supabase/types";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  event_admin: 1,
  admin: 2,
  super_admin: 3,
};

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data } = await supabase
    .from("users")
    .select("*, service:services(id, name, emoji), team:teams(id, name, slogan, color)")
    .eq("auth_id", user.id)
    .single();

  return data as User | null;
}

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data } = await supabase
    .from("allowlist_users")
    .select("role, is_active")
    .eq("email", user.email)
    .single();

  if (!data?.is_active) return null;
  return data.role as UserRole;
}

export async function requireRole(minRole: UserRole): Promise<UserRole> {
  const role = await getCurrentUserRole();
  if (!role || ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) {
    redirect("/login?error=unauthorized");
  }
  return role;
}

export async function requireProfileComplete(): Promise<User> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.profile_completed) redirect("/onboarding");
  return profile;
}

export async function updateLastLogin(authId: string) {
  const supabase = await createClient();
  await supabase
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("auth_id", authId);
}
