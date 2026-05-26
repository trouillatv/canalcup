import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AdminUserView, UserRole, Service } from "@/lib/supabase/types";
import { SCORE_EVENT_CATEGORIES_IN_TOTAL } from "@/lib/scoring/config";
import { getAdminEmails } from "@/lib/data/roles";

// Classement par SERVICE — moyenne de points par personne (les services
// n'ont pas le même effectif → on compare des moyennes, pas des totaux).
export interface ServiceLeaderboardRow {
  service: { id: string; name: string };
  members: number; // nb d'utilisateurs rattachés au service
  total: number; // somme des points individuels du service
  average: number; // total / members (1 décimale)
  rank: number;
}

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
    .select("*, service:services(id, name)")
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

/**
 * Classement des services par MOYENNE de points par personne.
 * Points individuels = predictions + bonus + quiz + animations (score_events
 * de l'allowlist) — toutes ces tables portent un user_id. Le babyfoot (score
 * d'équipe, sans user_id) et les votes (métrique sociale) sont exclus.
 * Dénominateur = nombre d'utilisateurs rattachés au service (effectif réel),
 * pour que les petits services actifs ne soient pas désavantagés.
 */
export async function getServiceLeaderboard(): Promise<ServiceLeaderboardRow[]> {
  try {
    const supabase = await createClient();
    const [
      { data: services },
      { data: users },
      { data: preds },
      { data: bonuses },
      { data: quizzes },
      { data: events },
      adminEmails,
    ] = await Promise.all([
      supabase.from("services").select("id, name, is_active").eq("is_active", true).order("sort_order"),
      supabase.from("users").select("id, service_id, email"),
      supabase.from("predictions").select("user_id, points_awarded"),
      supabase.from("bonus_predictions").select("user_id, points_awarded"),
      supabase.from("quiz_answers").select("user_id, points_awarded"),
      supabase.from("score_events").select("user_id, category, raw_points"),
      getAdminEmails(),
    ]);

    if (!services?.length || !users?.length) return [];

    type SvcRow = { id: string; name: string };
    type UserRow = { id: string; service_id: string | null; email: string | null };
    type PtRow = { user_id: string | null; points_awarded: number | null };
    type EvRow = { user_id: string | null; category: string | null; raw_points: number | null };

    // user_id → service_id + effectif par service. Les admins sont EXCLUS
    // (organisateurs hors classement) du compte ET des points.
    const userService = new Map<string, string>();
    const memberCount = new Map<string, number>();
    for (const u of (users as UserRow[])) {
      if (!u.service_id) continue;
      if (adminEmails.has((u.email ?? "").toLowerCase())) continue;
      userService.set(u.id, u.service_id);
      memberCount.set(u.service_id, (memberCount.get(u.service_id) ?? 0) + 1);
    }

    const allowed = new Set<string>(SCORE_EVENT_CATEGORIES_IN_TOTAL);
    const points = new Map<string, number>(); // service_id → total points individuels
    const add = (userId: string | null, pts: number | null) => {
      if (!userId || !pts) return;
      const svc = userService.get(userId);
      if (!svc) return;
      points.set(svc, (points.get(svc) ?? 0) + pts);
    };
    for (const r of (preds ?? []) as PtRow[]) add(r.user_id, r.points_awarded);
    for (const r of (bonuses ?? []) as PtRow[]) add(r.user_id, r.points_awarded);
    for (const r of (quizzes ?? []) as PtRow[]) add(r.user_id, r.points_awarded);
    for (const e of (events ?? []) as EvRow[]) {
      if (e.category && allowed.has(e.category)) add(e.user_id, e.raw_points);
    }

    const rows: ServiceLeaderboardRow[] = (services as SvcRow[])
      .map((s) => {
        const members = memberCount.get(s.id) ?? 0;
        const total = Math.round(points.get(s.id) ?? 0);
        const average = members > 0 ? Math.round((total / members) * 10) / 10 : 0;
        return { service: { id: s.id, name: s.name }, members, total, average, rank: 0 };
      })
      .filter((r) => r.members > 0); // on n'affiche que les services avec au moins 1 inscrit

    rows.sort((a, b) => b.average - a.average || b.total - a.total);
    rows.forEach((r, i) => (r.rank = i + 1));
    return rows;
  } catch {
    return [];
  }
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
