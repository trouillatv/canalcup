// Cron Vercel — sync TheSportsDB fixtures + scores into matches table
// Schedule : toutes les 2h pendant le tournoi (vercel.json)
// Sécurisé par Authorization: Bearer CRON_SECRET (injecté par Vercel)

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toFrench } from "@/lib/football/team-names";

const BASE = "https://www.thesportsdb.com/api/v1/json/3";
const WC_LEAGUE_ID = "4429";
const WC_SEASON = "2026";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStatus(e: any): string {
  const s = e.strStatus ?? "";
  if (s === "Match Finished" || s === "FT") return "finished";
  if (s === "1H" || s === "2H" || s === "ET" || s === "In Progress" || s === "HT") return "live";
  if (s === "Postponed") return "postponed";
  return "upcoming";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seasonRes = await fetch(`${BASE}/eventsseason.php?id=${WC_LEAGUE_ID}&s=${WC_SEASON}`, {
    next: { revalidate: 0 },
  });
  const seasonJson = await seasonRes.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: any[] = seasonJson?.events ?? [];

  if (!events.length) {
    return NextResponse.json({ ok: false, reason: "no events from TheSportsDB" });
  }

  const supabase = createAdminClient();
  const { data: matches } = await supabase
    .from("matches")
    .select("id, team_a, team_b, external_id");

  if (!matches) return NextResponse.json({ ok: false, reason: "db error" }, { status: 500 });

  let updated = 0;
  let inserted = 0;

  for (const e of events) {
    const externalId = parseInt(e.idEvent, 10);
    const status = mapStatus(e);
    const scoreA = e.intHomeScore !== null && e.intHomeScore !== "" ? parseInt(e.intHomeScore, 10) : null;
    const scoreB = e.intAwayScore !== null && e.intAwayScore !== "" ? parseInt(e.intAwayScore, 10) : null;

    const teamAFr = toFrench(e.strHomeTeam ?? "");
    const teamBFr = toFrench(e.strAwayTeam ?? "");

    const existing =
      matches.find((m) => m.external_id === externalId) ??
      matches.find(
        (m) =>
          m.team_a.toLowerCase() === teamAFr.toLowerCase() &&
          m.team_b.toLowerCase() === teamBFr.toLowerCase()
      );

    if (existing) {
      await supabase
        .from("matches")
        .update({ external_id: externalId, status, score_a: scoreA, score_b: scoreB, team_a: teamAFr, team_b: teamBFr })
        .eq("id", existing.id);
      updated++;
    } else {
      const kickoff = e.strTimestamp
        ? `${e.strTimestamp}Z`
        : `${e.dateEvent}T${e.strTime ?? "00:00:00"}Z`;
      const { error } = await supabase.from("matches").insert({
        external_id: externalId,
        competition: "FIFA World Cup 2026",
        phase: "Groupe",
        team_a: teamAFr,
        team_b: teamBFr,
        flag_a: null,
        flag_b: null,
        starts_at: kickoff,
        channel: "Canal+",
        status,
        score_a: scoreA,
        score_b: scoreB,
      });
      if (!error) {
        inserted++;
        matches.push({ id: "", team_a: teamAFr, team_b: teamBFr, external_id: externalId });
      }
    }
  }

  console.log(`[cron/sync-matches] updated=${updated} inserted=${inserted} total=${events.length}`);
  return NextResponse.json({ ok: true, updated, inserted, total: events.length });
}
