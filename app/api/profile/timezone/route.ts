// POST /api/profile/timezone — met à jour UNIQUEMENT le fuseau horaire
// d'affichage de l'utilisateur. Endpoint dédié (et non /profile/update)
// car ce dernier valide tout le profil ; ici on ne touche qu'un champ,
// utilisable depuis un widget autonome (TimezoneSelector).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TZ_OPTIONS } from "@/lib/utils";

const VALID_TZ = new Set<string>(TZ_OPTIONS.map((o) => o.tz));

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { timezone?: string };
  try { body = await req.json(); } catch { body = {}; }

  const timezone = (body.timezone ?? "").trim();
  if (!VALID_TZ.has(timezone)) {
    return NextResponse.json({ error: "Fuseau horaire invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .update({ timezone, updated_at: new Date().toISOString() })
    .eq("auth_id", user.id)
    .select("id, timezone")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Profil introuvable." },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({ timezone: data.timezone });
}
