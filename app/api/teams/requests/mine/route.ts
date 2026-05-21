// GET /api/teams/requests/mine — retourne :
//   - les équipes que j'ai créées (avec invite_code, nb membres)
//   - les demandes pending qui les concernent
// Sert à l'UI créateur (commit C) pour modérer.

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
  if (!me) return NextResponse.json({ teams: [], requests: [] });

  const { data: myTeams } = await admin
    .from("teams")
    .select("id, name, slogan, invite_code")
    .eq("created_by_user_id", me.id);

  const teams = myTeams ?? [];
  const ids = teams.map((t) => t.id);

  // Pour chaque équipe : compter les membres actuels.
  const teamsWithMembers = await Promise.all(
    teams.map(async (t) => {
      const { count } = await admin
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("team_id", t.id);
      const members = count ?? 0;
      return {
        ...t,
        members,
        slots_left: Math.max(0, TEAM_MAX_MEMBERS - members),
        full: members >= TEAM_MAX_MEMBERS,
      };
    })
  );

  if (ids.length === 0) return NextResponse.json({ teams: [], requests: [] });

  // 2 requêtes simples plutôt qu'un join FK (team_join_requests référence
  // users via user_id ET decided_by_user_id → désambiguïsation pénible).
  const { data: rawRequests } = await admin
    .from("team_join_requests")
    .select("id, team_id, user_id, created_at")
    .in("team_id", ids)
    .eq("status", "pending")
    .order("created_at");

  const userIds = [...new Set((rawRequests ?? []).map((r) => r.user_id))];
  const { data: usersRaw } = userIds.length
    ? await admin.from("users").select("id, display_name, name").in("id", userIds)
    : { data: [] };
  const usersById = new Map((usersRaw ?? []).map((u) => [u.id, u]));

  const requests = (rawRequests ?? []).map((r) => ({
    ...r,
    requester: usersById.get(r.user_id) ?? null,
  }));

  return NextResponse.json({
    teams: teamsWithMembers,
    requests,
  });
}
