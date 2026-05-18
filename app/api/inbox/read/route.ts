// POST /api/inbox/read → marque tous les courriers non lus de l'utilisateur
// courant comme lus. Appelé à l'ouverture de /inbox : le surlignage "nouveau"
// reste visible cette fois-ci (snapshot pris au GET) et le badge du TopBar
// retombe à 0 au changement de route suivant.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false });

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    if (!profile) return NextResponse.json({ ok: false });

    await supabase
      .from("inbox_events")
      .update({ is_read: true })
      .eq("user_id", profile.id)
      .eq("is_read", false);

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: false });
  }
}
