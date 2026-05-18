// GET /api/inbox → courriers de l'utilisateur courant (scopé session, comme
// /api/inbox/unread et /read). Sans session/profil → fallback mock (dev).

import { getInboxEvents } from "@/lib/data/content";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(await getInboxEvents());

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    const events = await getInboxEvents(profile?.id);
    return NextResponse.json(events, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(await getInboxEvents());
  }
}
