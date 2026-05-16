// Syncs TheSportsDB event IDs into matches.external_id
// POST /api/admin/sync-matches  (requires x-admin-secret header)
// Safe to run multiple times — uses upsert-style UPDATE by team names

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE = "https://www.thesportsdb.com/api/v1/json/3";
const WC_LEAGUE_ID = "4429";

// TheSportsDB team name → our DB team name mapping
const NAME_MAP: Record<string, string> = {
  "United States": "USA",
  "Korea Republic": "Corée du Sud",
  "South Korea": "Corée du Sud",
  "Côte d'Ivoire": "Ivory Coast",
  "Saudi Arabia": "Arabie Saoudite",
  "New Zealand": "Nouvelle-Zélande",
  "South Africa": "Afrique du Sud",
};

function normalize(name: string): string {
  return (NAME_MAP[name] ?? name).toLowerCase().trim();
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all WC2026 events from TheSportsDB
  const [nextRes, pastRes] = await Promise.all([
    fetch(`${BASE}/eventsnextleague.php?id=${WC_LEAGUE_ID}`),
    fetch(`${BASE}/eventspastleague.php?id=${WC_LEAGUE_ID}`),
  ]);

  const [nextJson, pastJson] = await Promise.all([nextRes.json(), pastRes.json()]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: any[] = [
    ...(nextJson?.events ?? []),
    ...(pastJson?.events ?? []),
  ];

  if (!events.length) {
    return NextResponse.json({ error: "No events from TheSportsDB" }, { status: 502 });
  }

  // Load all matches from DB
  const supabase = createAdminClient();
  const { data: matches, error } = await supabase.from("matches").select("id, team_a, team_b");
  if (error || !matches) {
    return NextResponse.json({ error: error?.message ?? "DB error" }, { status: 500 });
  }

  let updated = 0;
  const unmatched: string[] = [];

  for (const e of events) {
    const homeNorm = normalize(e.strHomeTeam ?? "");
    const awayNorm = normalize(e.strAwayTeam ?? "");

    const match = matches.find(
      (m) => normalize(m.team_a) === homeNorm && normalize(m.team_b) === awayNorm
    );

    if (!match) {
      unmatched.push(`${e.strHomeTeam} vs ${e.strAwayTeam}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("matches")
      .update({ external_id: parseInt(e.idEvent, 10) })
      .eq("id", match.id);

    if (!updateError) updated++;
  }

  return NextResponse.json({ updated, total: events.length, unmatched });
}
