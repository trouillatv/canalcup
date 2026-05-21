// POST /api/teams/create — l'utilisateur crée son équipe et en devient
// captain. Génère un invite_code unique (6 chars, alphabet sans
// ambiguïtés). Refuse si l'user a déjà une équipe ou une demande pending.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Format produit : 3 LETTRES majuscules + 3 CHIFFRES (ex. "ABC123").
// Lecture facile, mémorisable, identifiable d'un coup d'œil.
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"; // sans I/O (lisibilité)
const DIGITS = "23456789"; // sans 0/1 (lisibilité)
function generateInviteCode(): string {
  let s = "";
  for (let i = 0; i < 3; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  for (let i = 0; i < 3; i++) s += DIGITS[Math.floor(Math.random() * DIGITS.length)];
  return s;
}

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; slogan?: string };
  try { body = await req.json(); } catch { body = {}; }
  const name = (body.name ?? "").trim();
  // teams.slogan est NOT NULL en base — on défaut à chaîne vide (le user
  // pourra l'éditer plus tard ; éviter le crash NOT NULL à la création).
  const slogan = (body.slogan ?? "").trim();
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { error: "Nom d'équipe invalide (2 à 60 caractères)." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, team_id")
    .eq("auth_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // Mode BINÔME (un user = une seule équipe). Refus si l'user est DÉJÀ
  // dans une équipe (peu importe son rôle). Avant : on autorisait à créer
  // si l'user était seulement membre d'une autre — incohérent avec l'UI
  // qui cache l'onglet "Créer" dans ce cas. On aligne ici.
  const { data: existingMembership } = await admin
    .from("team_memberships")
    .select("team_id, role, team:teams(name)")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (existingMembership) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamName = (existingMembership as any).team?.name ?? "une équipe";
    return NextResponse.json(
      {
        error: `Tu fais déjà partie de « ${teamName} » — quitte-la d'abord ou rejoins-en une autre via un code d'invitation.`,
      },
      { status: 400 }
    );
  }
  // Pas de demande pending d'adhésion en parallèle (UX claire).
  const { data: pending } = await admin
    .from("team_join_requests")
    .select("id")
    .eq("user_id", profile.id)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return NextResponse.json(
      { error: "Tu as une demande d'adhésion en attente — annule-la avant de créer." },
      { status: 400 }
    );
  }
  // L'équipe créée devient-elle la principale ? Oui SSI l'user n'en a pas.
  const { data: existingPrimary } = await admin
    .from("team_memberships")
    .select("team_id")
    .eq("user_id", profile.id)
    .eq("is_primary", true)
    .maybeSingle();
  const willBePrimary = !existingPrimary;

  // Génération code unique avec retries (index partiel sur invite_code).
  let team = null;
  let lastError = "";
  for (let i = 0; i < 6; i++) {
    const code = generateInviteCode();
    const { data, error } = await admin
      .from("teams")
      .insert({
        name,
        slogan,
        invite_code: code,
        created_by_user_id: profile.id,
      })
      .select("*")
      .single();
    if (!error && data) { team = data; break; }
    if (error) {
      lastError = error.message;
      // Si ce n'est pas une collision sur l'index invite_code, on sort.
      if (!/uniq_teams_invite_code|invite_code/i.test(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }
  if (!team) {
    return NextResponse.json(
      { error: `Impossible de générer un code unique (${lastError}).` },
      { status: 500 }
    );
  }

  // Insertion de la membership (captain). is_primary calculé plus haut :
  // true SSI l'user n'avait pas encore d'équipe principale.
  const { error: memErr } = await admin
    .from("team_memberships")
    .insert({
      user_id: profile.id,
      team_id: team.id,
      role: "captain",
      is_primary: willBePrimary,
    });
  if (memErr) {
    await admin.from("teams").delete().eq("id", team.id);
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  // users.team_id = miroir de l'équipe principale (Phase A). On le met à
  // jour SEULEMENT si cette équipe vient de devenir la principale.
  // profile_completed=true est OK car contrainte relâchée (team_id optionnel).
  const userUpdate: Record<string, unknown> = {
    profile_completed: true,
    updated_at: new Date().toISOString(),
  };
  if (willBePrimary) {
    userUpdate.team_id = team.id;
    userUpdate.team_role = "captain";
  }
  const { error: upErr } = await admin
    .from("users")
    .update(userUpdate)
    .eq("id", profile.id);
  if (upErr) {
    // Best-effort rollback : membership + team.
    await admin.from("team_memberships").delete().eq("user_id", profile.id).eq("team_id", team.id);
    await admin.from("teams").delete().eq("id", team.id);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ team, is_primary: willBePrimary });
}
