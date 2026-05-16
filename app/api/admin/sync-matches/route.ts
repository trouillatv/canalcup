// Syncs TheSportsDB event IDs + scores into matches table
// POST /api/admin/sync-matches  (requires x-admin-secret header)
// DB uses English team names matching TheSportsDB — no mapping needed
// Also syncs the season endpoint to catch new fixtures as FIFA confirms them

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toFrench } from "@/lib/football/team-names";

const BASE = "https://www.thesportsdb.com/api/v1/json/3";
const WC_LEAGUE_ID = "4429";
const WC_SEASON = "2026";

function normalize(name: string): string {
  return name.toLowerCase().trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStatus(e: any): string {
  const s = e.strStatus ?? "";
  if (s === "Match Finished" || s === "FT") return "finished";
  if (s === "1H" || s === "2H" || s === "ET" || s === "In Progress") return "live";
  if (s === "HT" || s === "Half Time") return "live";
  if (s === "Postponed") return "postponed";
  return "upcoming";
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all WC2026 events (season endpoint = complete fixture list)
  const seasonRes = await fetch(`${BASE}/eventsseason.php?id=${WC_LEAGUE_ID}&s=${WC_SEASON}`);
  const seasonJson = await seasonRes.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: any[] = seasonJson?.events ?? [];

  if (!events.length) {
    return NextResponse.json({ error: "No events from TheSportsDB" }, { status: 502 });
  }

  // Load all matches from DB
  const supabase = createAdminClient();
  const { data: matches, error } = await supabase.from("matches").select("id, team_a, team_b, external_id");
  if (error || !matches) {
    return NextResponse.json({ error: error?.message ?? "DB error" }, { status: 500 });
  }

  let updated = 0;
  let inserted = 0;
  const unmatched: string[] = [];

  for (const e of events) {
    const teamAFr = toFrench(e.strHomeTeam ?? "");
    const teamBFr = toFrench(e.strAwayTeam ?? "");
    const homeNorm = normalize(teamAFr);
    const awayNorm = normalize(teamBFr);
    const externalId = parseInt(e.idEvent, 10);
    const status = mapStatus(e);
    const scoreA = e.intHomeScore !== null && e.intHomeScore !== "" ? parseInt(e.intHomeScore, 10) : null;
    const scoreB = e.intAwayScore !== null && e.intAwayScore !== "" ? parseInt(e.intAwayScore, 10) : null;

    // Match by external_id first (fastest), then by team names
    const match =
      matches.find((m) => m.external_id === externalId) ??
      matches.find((m) => normalize(m.team_a) === homeNorm && normalize(m.team_b) === awayNorm);

    if (match) {
      const { error: updateError } = await supabase
        .from("matches")
        .update({ external_id: externalId, status, score_a: scoreA, score_b: scoreB, team_a: teamAFr, team_b: teamBFr })
        .eq("id", match.id);
      if (!updateError) updated++;
    } else {
      const kickoff = e.strTimestamp ? `${e.strTimestamp}Z` : `${e.dateEvent}T${e.strTime ?? "00:00:00"}Z`;
      const { error: insertError } = await supabase.from("matches").insert({
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
      if (!insertError) {
        inserted++;
        matches.push({ id: "", team_a: teamAFr, team_b: teamBFr, external_id: externalId });
      } else {
        unmatched.push(`${teamAFr} vs ${teamBFr} (insert error: ${insertError.message})`);
      }
    }
  }

  return NextResponse.json({ updated, inserted, total: events.length, unmatched });
}
