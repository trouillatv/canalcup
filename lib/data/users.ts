import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AdminUserView, UserRole, Service } from "@/lib/supabase/types";

export async function getAllUsersForAdmin(): Promise<AdminUserView[]> {
  const adminClient = createAdminClient();

  // 1. allowlist_users (source de vérité pour accès/rôles)
  const { data: allowlist } = await adminClient
    .from("allowlist_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (!allowlist?.length) return [];

  // 2. profiles (display_name, service, etc.)
  const emails = allowlist.map((a) => a.email);
  const { data: profiles } = await adminClient
    .from("users")
    .select("*, service:services(id, name, emoji)")
    .in("email", emails);

  // 3. auth.users (last_sign_in_at)
  const { data: authData } = await adminClient.auth.admin.listUsers();
  const authByEmail = new Map(authData?.users?.map((u) => [u.email, u]) ?? []);
  const profileByEmail = new Map(profiles?.map((p) => [p.email, p]) ?? []);

  return allowlist.map((al) => {
    const profile = profileByEmail.get(al.email);
    const authUser = authByEmail.get(al.email);
    return {
      email: al.email,
      role: al.role as UserRole,
      is_active: al.is_active,
      allowlist_created_at: al.created_at,
      display_name: profile?.display_name ?? undefined,
      user_slug: profile?.user_slug ?? undefined,
      service_id: profile?.service_id ?? undefined,
      service: profile?.service as Service | undefined,
      football_level: profile?.football_level,
      profile_completed: profile?.profile_completed ?? false,
      last_login_at: profile?.last_login_at ?? undefined,
      auth_last_sign_in: authUser?.last_sign_in_at ?? undefined,
    } satisfies AdminUserView;
  });
}

export async function getServices(): Promise<Service[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as Service[];
}

export async function logAdminAction(
  adminEmail: string,
  action: string,
  targetEmail?: string,
  metadata?: Record<string, unknown>
) {
  const adminClient = createAdminClient();
  await adminClient.from("admin_logs").insert({
    admin_email: adminEmail,
    action,
    target_email: targetEmail,
    metadata: metadata ?? null,
  });
}
