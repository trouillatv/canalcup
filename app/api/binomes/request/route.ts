// POST /api/binomes/request — un user SANS équipe propose à une autre
// personne SANS équipe de former un binôme. Crée une demande pending. Le
// destinataire l'accepte/refuse via /api/binomes/respond.
//
// Garde-fous :
//   - demandeur et cible doivent être sans équipe (team_memberships vide)
//   - le demandeur ne peut avoir qu'UNE demande active à la fois
//   - pas de doublon pending demandeur → cible
//   - on ne se propose pas à soi-même

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function isInTeam(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<boolean> {
  const { count } = await admin
    .from("team_memberships")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { target_user_id?: string; proposed_team_name?: string };
  try { body = await req.json(); } catch { body = {}; }
  const targetUserId = (body.target_user_id ?? "").trim();
  const proposedName = (body.proposed_team_name ?? "").trim().slice(0, 60) || null;
  if (!targetUserId) {
    return NextResponse.json({ error: "target_user_id requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  if (targetUserId === me.id) {
    return NextResponse.json(
      { error: "Tu ne peux pas te proposer à toi-même." },
      { status: 400 }
    );
  }

  // La cible existe et est un participant inscrit.
  const { data: target } = await admin
    .from("users")
    .select("id, display_name, name, profile_completed")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!target || !target.profile_completed) {
    return NextResponse.json({ error: "Personne introuvable." }, { status: 404 });
  }

  // Aucun des deux ne doit déjà avoir une équipe.
  if (await isInTeam(admin, me.id)) {
    return NextResponse.json(
      { error: "Tu fais déjà partie d'une équipe." },
      { status: 400 }
    );
  }
  if (await isInTeam(admin, targetUserId)) {
    const tName = target.display_name ?? target.name ?? "Cette personne";
    return NextResponse.json(
      { error: `${tName} a déjà rejoint une équipe.` },
      { status: 400 }
    );
  }

  // Une seule demande active par demandeur.
  const { data: activeSent } = await admin
    .from("team_partner_requests")
    .select("id")
    .eq("requester_user_id", me.id)
    .eq("status", "pending")
    .maybeSingle();
  if (activeSent) {
    return NextResponse.json(
      { error: "Tu as déjà une demande en attente — annule-la avant d'en envoyer une autre." },
      { status: 400 }
    );
  }

  const { data: request, error } = await admin
    .from("team_partner_requests")
    .insert({
      requester_user_id: me.id,
      target_user_id: targetUserId,
      proposed_team_name: proposedName,
      status: "pending",
    })
    .select("id, target_user_id, proposed_team_name, status, created_at")
    .single();
  if (error) {
    // Collision sur l'index pending (doublon) → message clair.
    if (/uniq_tpr/i.test(error.message)) {
      return NextResponse.json(
        { error: "Une demande est déjà en cours." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    request,
    target: { id: target.id, name: target.display_name ?? target.name ?? "—" },
  });
}
