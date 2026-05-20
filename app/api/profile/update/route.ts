// POST /api/profile/update — édition des champs perso depuis /profile.
//
// Côté serveur (admin client) plutôt que supabase client direct : ça
// contourne d'éventuels soucis RLS et donne une réponse claire (ligne
// mise à jour ou erreur explicite). La contrainte DB
// users_profile_complete_chk continue d'être appliquée.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_LEVELS = new Set(["expert", "amateur", "ambiance"]);

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
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    display_name?: string;
    service_id?: string;
    football_level?: string;
  };
  try { body = await req.json(); } catch { body = {}; }

  const name = (body.name ?? "").trim();
  const display_name = (body.display_name ?? "").trim();
  const service_id = (body.service_id ?? "").trim();
  const football_level = (body.football_level ?? "").trim();

  if (name.length < 2) {
    return NextResponse.json({ error: "Nom trop court (min 2 caractères)." }, { status: 400 });
  }
  if (display_name.length < 2) {
    return NextResponse.json({ error: "Pseudo trop court (min 2 caractères)." }, { status: 400 });
  }
  if (!service_id) {
    return NextResponse.json({ error: "Service requis." }, { status: 400 });
  }
  if (!VALID_LEVELS.has(football_level)) {
    return NextResponse.json({ error: "Niveau foot invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .update({
      name,
      display_name,
      user_slug: slugify(display_name),
      service_id,
      football_level,
      updated_at: new Date().toISOString(),
    })
    .eq("auth_id", user.id)
    .select("id, name, display_name, user_slug, service_id, football_level")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Aucune ligne mise à jour (profil introuvable ?)." },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({ user: data });
}
