import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "user" | "admin" | "super_admin";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  admin: 1,
  super_admin: 2,
};

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
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
