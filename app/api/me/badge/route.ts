// GET /api/me/badge — compteur pour le badge d'icône PWA (navigator.setAppBadge).
//
// Renvoie le nombre de matchs OUVERTS aux pronos, à venir dans les prochaines
// BADGE_WINDOW_HOURS, que le joueur courant N'A PAS encore pronostiqués.
// C'est un « à faire » actionnable (pas la liste exhaustive de tous les matchs
// futurs, qui gonflerait le badge). 0 → badge effacé côté client.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Fenêtre glissante : on ne compte que les matchs bientôt (nudge « parie ceux du
// jour / de demain »), pas les 60 matchs de tout le tournoi.
const BADGE_WINDOW_HOURS = 48;

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

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const untilIso = new Date(now + BADGE_WINDOW_HOURS * 3600_000).toISOString();

    // Matchs pronostiquables imminents : à venir, pas encore commencés, dans la
    // fenêtre. (KO : équipes déjà déterminées → pas de placeholder à exclure.)
    const { data: matches } = await supabase
      .from("matches")
      .select("id")
      .eq("status", "upcoming")
      .gt("starts_at", nowIso)
      .lte("starts_at", untilIso);
    const ids = (matches ?? []).map((m) => m.id as string);
    if (!ids.length) return NextResponse.json({ count: 0 }, { headers: { "Cache-Control": "no-store" } });

    // Pronos déjà posés par le joueur sur ces matchs (RLS : ne voit que les siens).
    const { data: preds } = await supabase
      .from("predictions")
      .select("match_id")
      .eq("user_id", profile.id)
      .in("match_id", ids);
    const predicted = new Set((preds ?? []).map((p) => p.match_id as string));
    const count = ids.filter((id) => !predicted.has(id)).length;

    return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
