// POST /api/teams/join — l'utilisateur saisit un code d'invitation et
// crée une demande pending. Le créateur de l'équipe la validera ou
// rejettera ensuite. Refuse si l'user a déjà une équipe, déjà une
// demande pending, ou si l'équipe est complète (3/3).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TEAM_MAX_MEMBERS = 3;

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
    .select("id, team_id")
    .eq("auth_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // Un captain ne peut pas changer d'équipe (sinon il oprhelinerait
  // l'équipe qu'il a créée — MVP "no quit team" pour les créateurs).
  // Pour un simple membre, on AUTORISE de demander à rejoindre une AUTRE
  // équipe : c'est un switch (l'ancienne perd un membre à l'approbation).
  if (profile.team_id) {
    const { data: ownTeam } = await admin
      .from("teams")
      .select("id")
      .eq("created_by_user_id", profile.id)
      .maybeSingle();
    if (ownTeam) {
      return NextResponse.json(
        { error: "Tu es captain d'une équipe — un captain ne peut pas changer d'équipe." },
        { status: 400 }
      );
    }
  }

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

  // Switch sur la MÊME équipe = no-op inutile.
  if (profile.team_id === team.id) {
    return NextResponse.json(
      { error: "Tu fais déjà partie de cette équipe." },
      { status: 400 }
    );
  }

  // Cap 3 membres — refuse en amont (re-vérifié à l'approve pour la race).
  const { count } = await admin
    .from("users")
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
