import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AdminUserView, UserRole, Service } from "@/lib/supabase/types";
import { SCORE_EVENT_CATEGORIES_IN_TOTAL } from "@/lib/scoring/config";
import { getAdminEmails } from "@/lib/data/roles";
import { normalizeEmail } from "@/lib/auth/email-domain";
import { computeTeamScores } from "@/lib/data/teams";
import { selectAll } from "@/lib/data/select-all";

// Classement par SERVICE — moyenne de points par personne (les services
// n'ont pas le même effectif → on compare des moyennes, pas des totaux).
export interface ServiceLeaderboardRow {
  service: { id: string; name: string };
  members: number; // nb d'utilisateurs rattachés au service
  total: number; // somme des points individuels du service
  average: number; // total / members (1 décimale)
  rank: number;
}

export interface ServiceMemberRow {
  user_id: string;
  display_name: string | null;
  team_name: string | null;
  football_level: string | null;
  pronos: number;
  quiz: number;
  babyfoot: number;
  animations: number;
  total: number;
  rank: number;
}

export interface ServiceDetailRow {
  service: Service;
  members: number;
  total: number;
  average: number;
  rank: number;
  outOf: number;
  roster: ServiceMemberRow[];
  footballLevels: { expert: number; amateur: number; ambiance: number };
}

// Points Casino (joker) par joueur — source perso additionnelle pour les
// classements. Résilient : si la table joker_plays n'existe pas encore
// (migration non appliquée), renvoie une map vide sans casser le classement.
async function getCasinoPointsByUser(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const rows = await selectAll<{
      played_by_user_id: string | null;
      joker_type: string | null;
      status: string | null;
      metadata: Record<string, unknown> | null;
    }>(supabase, "joker_plays", "played_by_user_id, joker_type, status, metadata");
    for (const r of rows ?? []) {
      if (r.joker_type !== "casino" || !r.played_by_user_id) continue;
      const delta = Number((r.metadata as { points_delta?: unknown } | null)?.points_delta ?? 0);
      if (!Number.isFinite(delta) || delta === 0) continue;
      out.set(r.played_by_user_id, (out.get(r.played_by_user_id) ?? 0) + delta);
    }
  } catch {
    /* table absente → pas de points casino */
  }
  return out;
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
    // Client ADMIN : agrégat cross-joueurs. Avec RLS, les pronos/quiz des
    // autres joueurs sont tronqués → totaux de service sous-évalués.
    const supabase = createAdminClient();
    // selectAll : lecture paginée (PostgREST tronque à 1000 lignes sinon).
    const { data: services } = await supabase
      .from("services").select("id, name, is_active").eq("is_active", true).order("sort_order");
    const [
      users,
      preds,
      bonuses,
      quizzes,
      events,
      casinoByUser,
      adminEmails,
    ] = await Promise.all([
      selectAll<{ id: string; service_id: string | null; email: string | null }>(supabase, "users", "id, service_id, email"),
      selectAll<{ user_id: string | null; points_awarded: number | null }>(supabase, "predictions", "user_id, points_awarded"),
      selectAll<{ user_id: string | null; points_awarded: number | null }>(supabase, "bonus_predictions", "user_id, points_awarded"),
      selectAll<{ user_id: string | null; points_awarded: number | null }>(supabase, "quiz_answers", "user_id, points_awarded"),
      selectAll<{ user_id: string | null; category: string | null; source_type: string | null; raw_points: number | null }>(supabase, "score_events", "user_id, category, source_type, raw_points"),
      getCasinoPointsByUser(supabase),
      getAdminEmails(),
    ]);

    if (!services?.length || !users?.length) return [];

    type SvcRow = { id: string; name: string };
    type UserRow = { id: string; service_id: string | null; email: string | null };
    type PtRow = { user_id: string | null; points_awarded: number | null };
    type EvRow = { user_id: string | null; category: string | null; source_type: string | null; raw_points: number | null };

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
      if (e.source_type === "vote") continue;
      if (e.category && allowed.has(e.category)) add(e.user_id, e.raw_points);
    }
    // 🎰 Casino : points perso comptés dans le total du service.
    for (const [uid, pts] of casinoByUser) add(uid, pts);

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

export async function getServiceDetail(serviceId: string): Promise<ServiceDetailRow | null> {
  try {
    const supabase = await createClient();
    const [serviceRes, usersRes, serviceRows, individualRows, adminEmails] = await Promise.all([
      supabase
        .from("services")
        .select("id, name, is_active, sort_order, created_at")
        .eq("id", serviceId)
        .maybeSingle(),
      supabase.from("users").select("id, display_name, name, service_id, email, football_level").eq("service_id", serviceId),
      getServiceLeaderboard(),
      getIndividualLeaderboard(),
      getAdminEmails(),
    ]);

    if (!serviceRes.data) return null;

    type UserWithLevel = { id: string; email: string | null; football_level: string | null };
    const nonAdminUsers = (usersRes.data ?? [] as UserWithLevel[]).filter(
      (u: UserWithLevel) => !adminEmails.has(normalizeEmail(u.email ?? ""))
    );
    const memberIds = new Set(nonAdminUsers.map((u: UserWithLevel) => u.id));
    const levelByUser = new Map(nonAdminUsers.map((u: UserWithLevel) => [u.id, u.football_level]));

    const roster: ServiceMemberRow[] = individualRows
      .filter((row) => memberIds.has(row.user_id))
      .sort((a, b) => b.total - a.total || (a.display_name ?? "").localeCompare(b.display_name ?? ""))
      .map((row, index) => ({
        ...row,
        football_level: levelByUser.get(row.user_id) ?? null,
        rank: index + 1,
      }));

    const footballLevels = { expert: 0, amateur: 0, ambiance: 0 };
    for (const u of nonAdminUsers) {
      const lvl = (u as UserWithLevel).football_level;
      if (lvl === "expert") footballLevels.expert++;
      else if (lvl === "amateur") footballLevels.amateur++;
      else footballLevels.ambiance++;
    }

    const aggregate = serviceRows.find((row) => row.service.id === serviceId) ?? null;
    return {
      service: serviceRes.data as Service,
      members: aggregate?.members ?? roster.length,
      total: aggregate?.total ?? 0,
      average: aggregate?.average ?? 0,
      rank: aggregate?.rank ?? 0,
      outOf: serviceRows.length,
      roster,
      footballLevels,
    };
  } catch {
    return null;
  }
}

// ─── Classement INDIVIDUEL ───
// En plus du classement par binôme, on classe les PERSONNES. Score perso
// (même pondération %) = pronos + quiz propres au joueur + babyfoot +
// animations de son binôme (faits à deux → crédités aux 2 membres).
// Pronos/quiz sont individuels ici, baby/anim partagés par le binôme.
export interface IndividualRow {
  user_id: string;
  display_name: string | null;
  team_name: string | null;
  pronos: number; // pondéré (perso)
  quiz: number; // pondéré (perso)
  babyfoot: number; // pondéré (binôme, crédité aux 2)
  animations: number; // pondéré (binôme, crédité aux 2)
  total: number;
  rank: number;
}

export async function getIndividualLeaderboard(): Promise<IndividualRow[]> {
  try {
    // Client ADMIN : agrégat cross-joueurs (cf. getServiceLeaderboard) — sinon
    // RLS tronque la lecture des pronos/quiz des autres joueurs.
    const supabase = createAdminClient();
    // selectAll : lecture paginée (PostgREST tronque à 1000 lignes sinon).
    const [
      users,
      teams,
      preds,
      bonuses,
      quizzes,
      casinoByUser,
      adminEmails,
    ] = await Promise.all([
      selectAll<{ id: string; display_name: string | null; name: string | null; team_id: string | null; email: string | null }>(supabase, "users", "id, display_name, name, team_id, email"),
      selectAll<{ id: string; name: string }>(supabase, "teams", "id, name"),
      selectAll<{ user_id: string | null; points_awarded: number | null; predicted_score_a: number | null; predicted_score_b: number | null; match: { is_settled: boolean | null; score_a: number | null; score_b: number | null } | null }>(supabase, "predictions", "user_id, points_awarded, predicted_score_a, predicted_score_b, match:matches(is_settled, score_a, score_b)"),
      selectAll<{ user_id: string | null; points_awarded: number | null }>(supabase, "bonus_predictions", "user_id, points_awarded"),
      selectAll<{ user_id: string | null; points_awarded: number | null }>(supabase, "quiz_answers", "user_id, points_awarded"),
      getCasinoPointsByUser(supabase),
      getAdminEmails(),
    ]);
    if (!users?.length) return [];

    const teamName = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
    // Réutilise le calcul d'équipe pour babyRaw / animRaw par binôme.
    const teamAgg = await computeTeamScores(supabase, (teams ?? []).map((t: { id: string }) => t.id));

    type PtRow = { user_id: string | null; points_awarded: number | null };
    type PredRow = PtRow & {
      predicted_score_a: number | null; predicted_score_b: number | null;
      match: { is_settled: boolean | null; score_a: number | null; score_b: number | null } | null;
    };
    const pronosRaw = new Map<string, number>();
    const quizRaw = new Map<string, number>();
    const exactCount = new Map<string, number>(); // scores exacts (départage classement)
    const add = (m: Map<string, number>, id: string | null, n: number | null) => {
      if (!id) return;
      m.set(id, (m.get(id) ?? 0) + (n ?? 0));
    };
    const inc = (m: Map<string, number>, id: string | null) => {
      if (!id) return;
      m.set(id, (m.get(id) ?? 0) + 1);
    };
    for (const r of (preds ?? []) as unknown as PredRow[]) {
      add(pronosRaw, r.user_id, r.points_awarded);
      if (
        r.match?.is_settled && r.predicted_score_a != null && r.predicted_score_b != null &&
        r.predicted_score_a === r.match.score_a && r.predicted_score_b === r.match.score_b
      ) inc(exactCount, r.user_id);
    }
    for (const r of (bonuses ?? []) as PtRow[]) add(pronosRaw, r.user_id, r.points_awarded);
    for (const r of (quizzes ?? []) as PtRow[]) add(quizRaw, r.user_id, r.points_awarded);
    // 🎰 Casino : points perso pliés dans le pilier pronostics (jeu de pronos).
    for (const [uid, pts] of casinoByUser) add(pronosRaw, uid, pts);

    type URow = { id: string; display_name: string | null; name: string | null; team_id: string | null; email: string | null };
    const rows: IndividualRow[] = (users as URow[])
      .filter((u) => !adminEmails.has((u.email ?? "").toLowerCase())) // admins hors classement
      .map((u) => {
        const tb = u.team_id ? teamAgg.get(u.team_id) : undefined;
        const pronos = Math.round(pronosRaw.get(u.id) ?? 0);
        const quiz = Math.round(quizRaw.get(u.id) ?? 0);
        const babyfoot = Math.round(tb?.babyfootPoints ?? 0);
        const animations = Math.round(tb?.animRaw ?? 0);
        return {
          user_id: u.id,
          display_name: u.display_name ?? u.name ?? null,
          team_name: u.team_id ? teamName.get(u.team_id) ?? null : null,
          pronos,
          quiz,
          babyfoot,
          animations,
          total: pronos + quiz + babyfoot + animations,
          rank: 0,
        };
      })
      .filter((r) => r.display_name); // joueurs identifiés

    // Départage : à points égaux, plus de scores exacts devinés passe devant.
    rows.sort(
      (a, b) =>
        b.total - a.total ||
        (exactCount.get(b.user_id) ?? 0) - (exactCount.get(a.user_id) ?? 0) ||
        (a.display_name ?? "").localeCompare(b.display_name ?? "")
    );
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
