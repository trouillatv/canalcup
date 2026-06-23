// POST /api/teams/rename — le CAPITAINE renomme son équipe.
//
// Seul le créateur de l'équipe (teams.created_by_user_id) peut renommer.
// Même validation que la création : 2 à 60 caractères. Le nom est trim.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { team_id?: string; name?: string };
  try { body = await req.json(); } catch { body = {}; }
  const teamId = body.team_id;
  const name = (body.name ?? "").trim();
  if (!teamId) {
    return NextResponse.json({ error: "team_id requis." }, { status: 400 });
  }
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { error: "Nom d'équipe invalide (2 à 60 caractères)." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // Le capitaine = créateur de l'équipe (cohérent avec la fiche /teams/[id]
  // qui dérive viewerIsCaptain de created_by_user_id).
  const { data: team } = await admin
    .from("teams")
    .select("id, created_by_user_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) {
    return NextResponse.json({ error: "Équipe introuvable." }, { status: 404 });
  }
  if (team.created_by_user_id !== me.id) {
    return NextResponse.json(
      { error: "Seul le capitaine peut renommer l'équipe." },
      { status: 403 }
    );
  }

  const { data: updated, error } = await admin
    .from("teams")
    .update({ name })
    .eq("id", teamId)
    .select("id, name")
    .single();
  if (error) {
    // teams.name est UNIQUE en base → collision = nom déjà pris.
    if (/duplicate key|unique|teams_name_key/i.test(error.message)) {
      return NextResponse.json(
        { error: "Ce nom d'équipe est déjà pris." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, team: updated });
}
