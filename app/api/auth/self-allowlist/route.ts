// POST /api/auth/self-allowlist
//
// Décide si l'utilisateur connecté a le droit d'accéder à l'app, via
// le helper unique lib/auth/allowlist.ensureAllowlisted (déjà partagé
// avec /auth/callback). Voir le helper pour les règles métier.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureAllowlisted } from "@/lib/auth/allowlist";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
  }

  const result = await ensureAllowlisted(user.email);
  if (!result.ok) {
    return NextResponse.json(result, { status: 403 });
  }
  return NextResponse.json(result);
}
