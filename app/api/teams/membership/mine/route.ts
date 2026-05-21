// GET /api/teams/membership/mine — toutes les équipes auxquelles l'user
// appartient, avec leur rôle, statut primary, code d'invitation (si
// captain), nb membres / places restantes, et demandes pending qui
// concernent les équipes que l'user a créées.
//
// Source de vérité : team_memberships. Phase C du pivot multi-team.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEAM_MAX_MEMBERS } from "@/lib/teams/config";

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!me) return NextResponse.json({ teams: [] });

  // 1. Mes memberships + teams jointes.
  const { data: memberships } = await admin
    .from("team_memberships")
    .select(
      "team_id, role, is_primary, joined_at, team:teams(id, name, slogan, invite_code, created_by_user_id)"
    )
    .eq("user_id", me.id)
    .order("is_primary", { ascending: false })
    .order("joined_at", { ascending: true });

  const teamIds = (memberships ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => m.team?.id)
    .filter((x: string | undefined): x is string => !!x);

  // 2. Nb membres par équipe (1 requête par team — petit volume, simple).
  const memberCounts = new Map<string, number>();
  for (const tid of teamIds) {
    const { count } = await admin
      .from("team_memberships")
      .select("*", { count: "exact", head: true })
      .eq("team_id", tid);
    memberCounts.set(tid, count ?? 0);
  }

  // 3. Demandes pending pour les équipes que JE capitaine.
  const captainTeamIds = (memberships ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((m: any) => m.team?.created_by_user_id === me.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => m.team.id);

  let pendingByTeam = new Map<string, Array<{
    id: string;
    user_id: string;
    created_at: string;
    requester: { id: string; display_name: string | null; name: string | null } | null;
  }>>();
  if (captainTeamIds.length > 0) {
    const { data: rawReqs } = await admin
      .from("team_join_requests")
      .select("id, team_id, user_id, created_at")
      .in("team_id", captainTeamIds)
      .eq("status", "pending")
      .order("created_at");
    const userIds = [...new Set((rawReqs ?? []).map((r) => r.user_id))];
    const { data: usersRaw } = userIds.length
      ? await admin.from("users").select("id, display_name, name").in("id", userIds)
      : { data: [] };
    const usersById = new Map((usersRaw ?? []).map((u) => [u.id, u]));
    pendingByTeam = (rawReqs ?? []).reduce((acc, r) => {
      const list = acc.get(r.team_id) ?? [];
      list.push({
        id: r.id,
        user_id: r.user_id,
        created_at: r.created_at,
        requester: usersById.get(r.user_id) ?? null,
      });
      acc.set(r.team_id, list);
      return acc;
    }, new Map<string, Array<{
      id: string;
      user_id: string;
      created_at: string;
      requester: { id: string; display_name: string | null; name: string | null } | null;
    }>>());
  }

  // 4. Sortie aplatie pour l'UI.
  const teams = (memberships ?? []).map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (m as any).team;
    const members = memberCounts.get(t?.id) ?? 0;
    const isCaptain = t?.created_by_user_id === me.id;
    return {
      id: t?.id,
      name: t?.name,
      slogan: t?.slogan,
      invite_code: isCaptain ? t?.invite_code : null, // jamais exposer le code aux non-captains
      role: m.role,
      is_primary: m.is_primary,
      is_captain: isCaptain,
      members,
      slots_left: Math.max(0, TEAM_MAX_MEMBERS - members),
      full: members >= TEAM_MAX_MEMBERS,
      pending_requests: isCaptain ? pendingByTeam.get(t?.id) ?? [] : [],
    };
  });

  return NextResponse.json({ teams });
}
