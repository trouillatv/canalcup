// POST /api/teams/membership/leave — quitte une équipe.
//
// Règles (Phase B multi-team) :
// - Un captain ne peut PAS quitter son équipe (l'orphelinerait — pas
//   de transfert dans le MVP). Pour libérer, il faudrait un transfert
//   de captainat (à coder plus tard).
// - Si l'équipe quittée était la principale, on promeut automatiquement
//   une autre membership en principale (la plus ancienne). S'il n'en
//   reste aucune, users.team_id devient NULL et team_role redevient
//   'member' par défaut.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { competitionLock } from "@/lib/event/status";

export async function POST(req: Request) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
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

  const { data: membership } = await admin
    .from("team_memberships")
    .select("role, is_primary")
    .eq("user_id", me.id)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Tu n'es pas membre de cette équipe." }, { status: 404 });
  }
  if (membership.role === "captain") {
    return NextResponse.json(
      { error: "Un captain ne peut pas quitter son équipe (orphelinerait l'équipe)." },
      { status: 400 }
    );
  }

  // 1. Suppression de la membership.
  const { error: delErr } = await admin
    .from("team_memberships")
    .delete()
    .eq("user_id", me.id)
    .eq("team_id", teamId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // 2. Si c'était la principale, promouvoir la plus ancienne restante.
  //    Sinon, users.team_id reste sur l'actuelle.
  if (membership.is_primary) {
    const { data: next } = await admin
      .from("team_memberships")
      .select("team_id, role")
      .eq("user_id", me.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      // Promote la plus ancienne en primary.
      const { error: promErr } = await admin
        .from("team_memberships")
        .update({ is_primary: true })
        .eq("user_id", me.id)
        .eq("team_id", next.team_id);
      if (promErr) return NextResponse.json({ error: promErr.message }, { status: 500 });

      await admin
        .from("users")
        .update({
          team_id: next.team_id,
          team_role: next.role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", me.id);
    } else {
      // Plus aucune équipe → users.team_id NULL (autorisé par la contrainte
      // relâchée). profile_completed reste true tant que les autres champs
      // sont OK. Le user pourra pronostiquer dès qu'il rejoindra à nouveau.
      await admin
        .from("users")
        .update({
          team_id: null,
          team_role: "member",
          updated_at: new Date().toISOString(),
        })
        .eq("id", me.id);
    }
  }

  return NextResponse.json({ ok: true });
}
