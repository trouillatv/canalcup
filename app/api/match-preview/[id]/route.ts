// GET /api/match-preview/[id]
// Dossier pré-match TV : pour chaque équipe → forme (V/N/D), derniers
// résultats, joueurs clés (offensifs), et compos probables si le provider
// les expose déjà. Source forme/effectif : data/wc-teams.json (lib/football).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWCTeamByName, formCode, type WCTeam } from "@/lib/football/wc-teams";
import { getMatchDetail } from "@/services/football";

function isAttacker(pos: string | null): boolean {
  return /attaquant|avant|ailier|buteur/i.test(pos ?? "");
}

function teamDossier(name: string) {
  const t: WCTeam | null = getWCTeamByName(name);
  if (!t) return { name, form: [], formCodes: [], recentScores: [], keyPlayers: [], squadValue: null };
  const keyPlayers = t.players
    .filter((p) => isAttacker(p.position))
    .slice(0, 5)
    .map((p) => ({ name: p.name, position: p.position, club: p.club }));
  return {
    name: t.name,
    form: t.form.slice(0, 5),
    formCodes: t.form.slice(0, 5).map(formCode),
    recentScores: t.recentScores.slice(0, 5),
    keyPlayers,
    squadValue: t.squadValue,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: match } = await supabase
    .from("matches")
    .select("team_a, team_b, status")
    .eq("id", id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // Compos probables : seulement si déjà disponibles (n'appelle pas de resync
  // lourd pour un match upcoming — getMatchDetail respecte la fenêtre).
  let lineups: { home: string[]; away: string[] } | null = null;
  try {
    const detail = await getMatchDetail(id);
    if (detail?.lineups) {
      lineups = {
        home: detail.lineups.home.filter((p) => p.is_starting).map((p) => p.player_name),
        away: detail.lineups.away.filter((p) => p.is_starting).map((p) => p.player_name),
      };
    }
  } catch {
    /* compos optionnelles */
  }

  return NextResponse.json(
    {
      home: teamDossier(match.team_a),
      away: teamDossier(match.team_b),
      lineups,
    },
    { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" } }
  );
}
