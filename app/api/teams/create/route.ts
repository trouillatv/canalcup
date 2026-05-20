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
  if (profile.team_id) {
    return NextResponse.json(
      { error: "Tu fais déjà partie d'une équipe — un user = une équipe." },
      { status: 400 }
    );
  }
  const { data: pending } = await admin
    .from("team_join_requests")
    .select("id")
    .eq("user_id", profile.id)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return NextResponse.json(
      { error: "Tu as déjà une demande en attente — annule-la avant de créer." },
      { status: 400 }
    );
  }

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

  // L'auteur devient membre + captain. profile_completed=true si les
  // autres champs requis sont déjà là (sinon la contrainte CHECK rejette).
  const { error: upErr } = await admin
    .from("users")
    .update({
      team_id: team.id,
      team_role: "captain",
      profile_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);
  if (upErr) {
    // Best-effort rollback : on retire l'équipe juste créée.
    await admin.from("teams").delete().eq("id", team.id);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ team });
}
