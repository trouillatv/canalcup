// POST /api/jokers/play — le joueur courant joue un joker.
// Body : { type: JokerType, target_user_id?: string, match_id?: string, stake?: number }
// stake = mise du Kamikaze (1..20 pts), ignoré pour les autres jokers.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { playJoker } from "@/lib/jokers/service";
import { isJokerType } from "@/lib/jokers/catalog";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type = body?.type;
  if (!isJokerType(type)) return NextResponse.json({ error: "Type de joker invalide." }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const result = await playJoker({
    playedByUserId: me.id,
    type,
    targetUserId: typeof body?.target_user_id === "string" ? body.target_user_id : null,
    matchId: typeof body?.match_id === "string" ? body.match_id : null,
    stake: typeof body?.stake === "number" ? body.stake : null,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    publicMessage: result.publicMessage,
    data: result.data ?? {},
  });
}
