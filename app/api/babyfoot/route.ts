// État public du Tournoi Baby-foot (hub joueur + TV) : édition active, binômes,
// classements de poule, tableau final, podium + historique des champions.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOfficialTournament, buildPublicState, getChampionsHistory } from "@/lib/data/babyfoot";

export const revalidate = 15;
// La route lit Supabase à chaque requête : elle ne doit pas être pré-rendue
// pendant le build (où les variables d’environnement peuvent être absentes).
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();
  const t = await getActiveOfficialTournament(admin);
  if (!t) return NextResponse.json({ tournament: null, champions: await getChampionsHistory(admin) });

  const [state, champions] = await Promise.all([buildPublicState(admin, t.id), getChampionsHistory(admin)]);
  return NextResponse.json({
    tournament: {
      id: t.id, name: t.name, season: t.season, status: t.status, event_date: t.event_date,
      registration_open: t.registration_open, target_teams: t.target_teams, format: t.format,
      draw_at: t.draw_at, kickoff_at: t.kickoff_at,
    },
    ...state,
    champions,
  });
}
