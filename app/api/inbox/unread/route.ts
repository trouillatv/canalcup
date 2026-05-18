// GET /api/inbox/unread → { count } : nombre de courriers non lus de
// l'utilisateur courant (pour le badge du sidebar). Scopé par session.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ count: 0 });

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    if (!profile) return NextResponse.json({ count: 0 });

    const { count } = await supabase
      .from("inbox_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false);

    return NextResponse.json(
      { count: count ?? 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
