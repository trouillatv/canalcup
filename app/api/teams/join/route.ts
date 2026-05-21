// POST /api/teams/join — l'utilisateur saisit un code d'invitation et
// crée une demande pending. Le créateur de l'équipe la validera ou
// rejettera ensuite. Refuse si l'user a déjà une équipe, déjà une
// demande pending, ou si l'équipe est complète.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEAM_MAX_MEMBERS } from "@/lib/teams/config";

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { invite_code?: string };
  try { body = await req.json(); } catch { body = {}; }
  const code = String(body.invite_code ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Code d'invitation requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // Multi-équipes (Phase B) : on autorise N memberships. Restrictions :
  //   - 1 seule demande pending à la fois (UX claire)
  //   - pas déjà membre de l'équipe cible (vérif team_memberships)
  //   - cap 3 membres / équipe (re-checké à l'approve)
  const { data: existing } = await admin
    .from("team_join_requests")
    .select("id, team_id")
    .eq("user_id", profile.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Tu as déjà une demande en attente." },
      { status: 400 }
    );
  }

  const { data: team } = await admin
    .from("teams")
    .select("id, name, created_by_user_id")
    .eq("invite_code", code)
    .maybeSingle();
  if (!team) {
    return NextResponse.json({ error: "Code d'invitation invalide." }, { status: 404 });
  }

  // Déjà membre de cette équipe ?
  const { data: alreadyMember } = await admin
    .from("team_memberships")
    .select("user_id")
    .eq("user_id", profile.id)
    .eq("team_id", team.id)
    .maybeSingle();
  if (alreadyMember) {
    return NextResponse.json(
      { error: "Tu fais déjà partie de cette équipe." },
      { status: 400 }
    );
  }

  // Cap 3 membres — compté via team_memberships (source de vérité multi-team).
  const { count } = await admin
    .from("team_memberships")
    .select("*", { count: "exact", head: true })
    .eq("team_id", team.id);
  if ((count ?? 0) >= TEAM_MAX_MEMBERS) {
    return NextResponse.json(
      { error: `Cette équipe est complète (${TEAM_MAX_MEMBERS}/${TEAM_MAX_MEMBERS} membres).` },
      { status: 400 }
    );
  }

  const { data: request, error } = await admin
    .from("team_join_requests")
    .insert({ team_id: team.id, user_id: profile.id, status: "pending" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    request,
    team: { id: team.id, name: team.name },
  });
}
