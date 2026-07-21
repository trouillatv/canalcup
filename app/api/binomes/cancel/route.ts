// POST /api/binomes/cancel — le DEMANDEUR annule sa propre demande pending.
// Le statut passe à cancelled ; il peut ensuite proposer à quelqu'un d'autre.

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

  let body: { request_id?: string };
  try { body = await req.json(); } catch { body = {}; }
  const requestId = body.request_id;
  if (!requestId) {
    return NextResponse.json({ error: "request_id requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const { data: pr } = await admin
    .from("team_partner_requests")
    .select("id, status, requester_user_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!pr) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  if (pr.requester_user_id !== me.id) {
    return NextResponse.json(
      { error: "Seul l'auteur de la demande peut l'annuler." },
      { status: 403 }
    );
  }
  if (pr.status !== "pending") {
    return NextResponse.json({ error: "Demande déjà traitée." }, { status: 400 });
  }

  const { error } = await admin
    .from("team_partner_requests")
    .update({ status: "cancelled", decided_at: new Date().toISOString() })
    .eq("id", pr.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
