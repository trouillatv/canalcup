// POST /api/teams/membership/set-primary — change l'équipe principale.
//
// L'équipe principale est celle qui reçoit les points (predictions / quiz /
// bonus / animations) via le team_id écrit au moment de l'action. La table
// team_memberships est la source de vérité (1 SEULE is_primary=true par
// user via index partiel) ; users.team_id en est le miroir maintenu par
// l'app.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { team_id?: string };
  try { body = await req.json(); } catch { body = {}; }
  const teamId = body.team_id;
  if (!teamId) {
    return NextResponse.json({ error: "team_id requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const { data: targetMembership } = await admin
    .from("team_memberships")
    .select("role, is_primary")
    .eq("user_id", me.id)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!targetMembership) {
    return NextResponse.json(
      { error: "Tu n'es pas membre de cette équipe." },
      { status: 404 }
    );
  }
  if (targetMembership.is_primary) {
    return NextResponse.json({ ok: true, already: true });
  }

  // L'index unique partiel (uniq_tm_one_primary_per_user) refuse 2 primary
  // à la fois → on doit d'abord retirer l'ancien avant de poser le nouveau.
  const { error: clearErr } = await admin
    .from("team_memberships")
    .update({ is_primary: false })
    .eq("user_id", me.id)
    .eq("is_primary", true);
  if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 });

  const { error: setErr } = await admin
    .from("team_memberships")
    .update({ is_primary: true })
    .eq("user_id", me.id)
    .eq("team_id", teamId);
  if (setErr) return NextResponse.json({ error: setErr.message }, { status: 500 });

  // Sync miroir users.team_id + team_role.
  await admin
    .from("users")
    .update({
      team_id: teamId,
      team_role: targetMembership.role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", me.id);

  return NextResponse.json({ ok: true });
}
