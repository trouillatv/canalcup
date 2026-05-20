// POST /api/teams/requests/decide — le créateur (= captain) approuve ou
// rejette une demande pending. Si approve : pose users.team_id et
// profile_completed=true sur le demandeur ; vérifie le cap 3 membres
// (double vérif au cas où plusieurs approbations en parallèle).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TEAM_MAX_MEMBERS = 3;

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { request_id?: string; decision?: string };
  try { body = await req.json(); } catch { body = {}; }
  const requestId = body.request_id;
  const decision = body.decision;
  if (!requestId || (decision !== "approve" && decision !== "reject")) {
    return NextResponse.json(
      { error: "request_id et decision (approve|reject) requis." },
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

  const { data: joinReq } = await admin
    .from("team_join_requests")
    .select("id, status, team_id, user_id, team:teams(id, name, created_by_user_id)")
    .eq("id", requestId)
    .maybeSingle();
  if (!joinReq) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  if (joinReq.status !== "pending") {
    return NextResponse.json({ error: "Demande déjà traitée." }, { status: 400 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const team = (joinReq as any).team;
  if (!team || team.created_by_user_id !== me.id) {
    return NextResponse.json(
      { error: "Seul le créateur de l'équipe peut décider." },
      { status: 403 }
    );
  }

  if (decision === "approve") {
    // Cap 3 (race-safe re-check)
    const { count } = await admin
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("team_id", team.id);
    if ((count ?? 0) >= TEAM_MAX_MEMBERS) {
      return NextResponse.json(
        { error: `Équipe complète (${TEAM_MAX_MEMBERS}/${TEAM_MAX_MEMBERS}).` },
        { status: 400 }
      );
    }

    // Le demandeur a-t-il déjà été placé dans la MÊME équipe entre temps ?
    // (un membre simple peut switcher d'équipe → on accepte si différent.)
    const { data: requester } = await admin
      .from("users")
      .select("team_id")
      .eq("id", joinReq.user_id)
      .single();
    if (!requester) {
      return NextResponse.json({ error: "Demandeur introuvable." }, { status: 404 });
    }
    if (requester.team_id === team.id) {
      return NextResponse.json(
        { error: "Ce user est déjà dans cette équipe." },
        { status: 400 }
      );
    }

    const { error: upErr } = await admin
      .from("users")
      .update({
        team_id: team.id,
        profile_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", joinReq.user_id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { error: rErr } = await admin
    .from("team_join_requests")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      decided_by_user_id: me.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", joinReq.id);
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, decision });
}
