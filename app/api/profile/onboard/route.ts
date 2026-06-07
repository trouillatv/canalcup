// POST /api/profile/onboard
//
// Termine l'onboarding en une seule requête côté serveur. Avant ce
// commit, l'onboarding faisait un UPDATE côté client + une création
// d'équipe — l'équipe a été rendue FACULTATIVE (un user peut entrer
// dans l'app sans équipe, et n'en a besoin que pour s'inscrire à une
// animation / pronostiquer). Le UPDATE côté client posait aussi un
// problème : si la row public.users n'existait pas encore (cas d'un
// signup tout frais), l'UPDATE ne touchait rien et l'enregistrement
// tournait en boucle infinie.
//
// Ce endpoint fait un UPSERT serveur via service role, donc :
//   - crée la row si elle n'existe pas
//   - met à jour si elle existe
//   - sets profile_completed = true sans dépendre d'une équipe
//
// Inputs : display_name, service_id, football_level
// Output : { ok: true, user_id }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TZ, TZ_OPTIONS } from "@/lib/utils";

const VALID_TZ = new Set<string>(TZ_OPTIONS.map((o) => o.tz));

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  const serviceId = typeof body.service_id === "string" ? body.service_id : "";
  const footballLevel = typeof body.football_level === "string" ? body.football_level : "";
  // Fuseau facultatif (auto-détecté côté client). Validé sinon repli NC.
  const timezone =
    typeof body.timezone === "string" && VALID_TZ.has(body.timezone)
      ? body.timezone
      : DEFAULT_TZ;

  if (displayName.length < 2) {
    return NextResponse.json({ error: "Pseudo requis (2 caractères min)." }, { status: 400 });
  }
  if (!serviceId) {
    return NextResponse.json({ error: "Service requis." }, { status: 400 });
  }
  if (!["expert", "amateur", "ambiance"].includes(footballLevel)) {
    return NextResponse.json({ error: "Niveau foot requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const slug = slugify(displayName) || `user-${Date.now().toString(36)}`;

  // Existe déjà ? Si oui on UPDATE, sinon on INSERT.
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  const payload = {
    auth_id: user.id,
    email: user.email,
    name: displayName,
    display_name: displayName,
    user_slug: slug,
    service_id: serviceId,
    football_level: footballLevel,
    timezone,
    onboarding_step: 1,
    profile_completed: true,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await admin.from("users").update(payload).eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, user_id: existing.id });
  }

  const { data: inserted, error } = await admin
    .from("users")
    .insert(payload)
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, user_id: inserted.id });
}
