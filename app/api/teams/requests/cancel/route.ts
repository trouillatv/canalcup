// POST /api/teams/requests/cancel — l'utilisateur annule SA demande
// pending (autre cas que /decide qui appartient au captain). Permet de
// se rattraper si on a tapé le mauvais code.

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

  const body = await req.json().catch(() => ({}));
  const requestId = typeof body.request_id === "string" ? body.request_id : "";
  if (!requestId) {
    return NextResponse.json({ error: "request_id requis" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // Sécurité : on ne peut annuler que SA propre demande pending.
  const { data: row } = await admin
    .from("team_join_requests")
    .select("id, user_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  if (row.user_id !== me.id) {
    return NextResponse.json({ error: "Pas ta demande." }, { status: 403 });
  }
  if (row.status !== "pending") {
    return NextResponse.json({ error: "Demande déjà traitée." }, { status: 400 });
  }

  const { error } = await admin
    .from("team_join_requests")
    .delete()
    .eq("id", requestId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
