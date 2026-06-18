// POST /api/binomes/respond — le DESTINATAIRE d'une demande "binôme"
// accepte ou refuse.
//
// accept :
//   - re-vérifie que ni le demandeur ni le destinataire n'a d'équipe
//   - crée l'équipe (nom proposé sinon défaut), avec invite_code unique
//   - demandeur = captain, destinataire = member (les deux is_primary)
//   - met à jour users.team_id / team_role / profile_completed pour les deux
//   - lie created_team_id à la demande, status=accepted
//   - expire les autres demandes pending impliquant l'un des deux
// reject :
//   - status=rejected (le demandeur pourra proposer à quelqu'un d'autre)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Même format que /api/teams/create : 3 lettres + 3 chiffres, sans ambiguïté.
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789";
function generateInviteCode(): string {
  let s = "";
  for (let i = 0; i < 3; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  for (let i = 0; i < 3; i++) s += DIGITS[Math.floor(Math.random() * DIGITS.length)];
  return s;
}

function firstName(display: string | null, name: string | null): string {
  const full = (display ?? name ?? "").trim();
  return full.split(/\s+/)[0] || "Binôme";
}

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { request_id?: string; decision?: string };
  try { body = await req.json(); } catch { body = {}; }
  const requestId = body.request_id;
  const decision = body.decision;
  if (!requestId || (decision !== "accept" && decision !== "reject")) {
    return NextResponse.json(
      { error: "request_id et decision (accept|reject) requis." },
      { status: 400 }
    );
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
    .select("id, status, requester_user_id, target_user_id, proposed_team_name")
    .eq("id", requestId)
    .maybeSingle();
  if (!pr) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  if (pr.target_user_id !== me.id) {
    return NextResponse.json(
      { error: "Seul le destinataire peut répondre à cette demande." },
      { status: 403 }
    );
  }
  if (pr.status !== "pending") {
    return NextResponse.json({ error: "Demande déjà traitée." }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  // ---- REFUS ----
  if (decision === "reject") {
    const { error } = await admin
      .from("team_partner_requests")
      .update({ status: "rejected", decided_at: nowIso })
      .eq("id", pr.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, decision: "reject" });
  }

  // ---- ACCEPTATION ----
  const requesterId = pr.requester_user_id;
  const targetId = pr.target_user_id;

  // Re-vérif anti-race : aucun des deux ne doit déjà être en équipe.
  const { count: reqCount } = await admin
    .from("team_memberships")
    .select("*", { count: "exact", head: true })
    .eq("user_id", requesterId);
  const { count: tgtCount } = await admin
    .from("team_memberships")
    .select("*", { count: "exact", head: true })
    .eq("user_id", targetId);
  if ((reqCount ?? 0) > 0 || (tgtCount ?? 0) > 0) {
    // Un des deux a rejoint une équipe entre-temps → on expire la demande.
    await admin
      .from("team_partner_requests")
      .update({ status: "expired", decided_at: nowIso })
      .eq("id", pr.id);
    return NextResponse.json(
      { error: "Un des deux a déjà rejoint une équipe — demande expirée." },
      { status: 400 }
    );
  }

  // Profils pour le nom d'équipe par défaut.
  const { data: people } = await admin
    .from("users")
    .select("id, display_name, name")
    .in("id", [requesterId, targetId]);
  const reqP = (people ?? []).find((p) => p.id === requesterId);
  const tgtP = (people ?? []).find((p) => p.id === targetId);

  const proposed = (pr.proposed_team_name ?? "").trim();
  const baseName =
    proposed.length >= 2
      ? proposed.slice(0, 60)
      : `${firstName(reqP?.display_name ?? null, reqP?.name ?? null)} & ${firstName(
          tgtP?.display_name ?? null,
          tgtP?.name ?? null
        )}`;

  // Création de l'équipe avec code unique. teams.name ET invite_code sont
  // uniques → on retente en suffixant le nom si collision de nom.
  let team: { id: string; name: string } | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 6 && !team; attempt++) {
    const name = attempt === 0 ? baseName : `${baseName.slice(0, 56)} ${attempt + 1}`;
    const code = generateInviteCode();
    const { data, error } = await admin
      .from("teams")
      .insert({
        name,
        slogan: "", // NOT NULL en base — éditable plus tard
        invite_code: code,
        created_by_user_id: requesterId,
      })
      .select("id, name")
      .single();
    if (!error && data) { team = data; break; }
    if (error) {
      lastError = error.message;
      // Collision nom OU invite_code → on retente ; sinon on sort.
      if (!/uniq_teams_invite_code|invite_code|teams_name|duplicate key/i.test(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }
  if (!team) {
    return NextResponse.json(
      { error: `Impossible de créer l'équipe (${lastError}).` },
      { status: 500 }
    );
  }

  // Memberships : demandeur captain, destinataire member ; les deux primaires
  // (mode binôme = une seule équipe par user).
  const { error: memErr } = await admin
    .from("team_memberships")
    .insert([
      { user_id: requesterId, team_id: team.id, role: "captain", is_primary: true },
      { user_id: targetId, team_id: team.id, role: "member", is_primary: true },
    ]);
  if (memErr) {
    await admin.from("teams").delete().eq("id", team.id);
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  // Miroir users (team_id + team_role + profil complété).
  const { error: upReqErr } = await admin
    .from("users")
    .update({ team_id: team.id, team_role: "captain", profile_completed: true, updated_at: nowIso })
    .eq("id", requesterId);
  const { error: upTgtErr } = await admin
    .from("users")
    .update({ team_id: team.id, team_role: "member", profile_completed: true, updated_at: nowIso })
    .eq("id", targetId);
  if (upReqErr || upTgtErr) {
    // Best-effort rollback.
    await admin.from("team_memberships").delete().eq("team_id", team.id);
    await admin.from("teams").delete().eq("id", team.id);
    return NextResponse.json(
      { error: (upReqErr ?? upTgtErr)!.message },
      { status: 500 }
    );
  }

  // Marque la demande acceptée et lie l'équipe créée.
  await admin
    .from("team_partner_requests")
    .update({ status: "accepted", created_team_id: team.id, decided_at: nowIso })
    .eq("id", pr.id);

  // Expire toutes les AUTRES demandes pending impliquant l'un des deux : ils
  // ont désormais une équipe, ces demandes n'ont plus de sens.
  await admin
    .from("team_partner_requests")
    .update({ status: "expired", decided_at: nowIso })
    .eq("status", "pending")
    .or(
      [
        `requester_user_id.eq.${requesterId}`,
        `target_user_id.eq.${requesterId}`,
        `requester_user_id.eq.${targetId}`,
        `target_user_id.eq.${targetId}`,
      ].join(",")
    );

  return NextResponse.json({
    ok: true,
    decision: "accept",
    team: { id: team.id, name: team.name },
  });
}
