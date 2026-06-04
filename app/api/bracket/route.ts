import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PHASE_ORDER = ["Groupe", "Huitièmes", "Quarts", "Demis", "3ème place", "Finale"];

export async function GET() {
  const supabase = createAdminClient();

  const [{ data: matchesRaw }, { data: standings }] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .in("competition", ["Coupe du Monde 2026", "FIFA World Cup 2026"])
      .order("starts_at", { ascending: true }),
    supabase
      .from("standings")
      .select("*")
      .in("competition", ["Coupe du Monde 2026", "FIFA World Cup 2026"])
      .order("points", { ascending: false }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches: any[] = matchesRaw ?? [];

  // Build a team → group-letter map from the standings (the only reliable
  // source for which pool a team is in — match.stage is often a matchday number).
  const groupLetterOf = (s?: string | null) =>
    s?.match(/group(?:e)?\s*([a-l])\b/i)?.[1]?.toUpperCase() ??
    s?.trim().match(/^([a-l])$/i)?.[1]?.toUpperCase() ??
    null;

  const teamToGroup: Record<string, string> = {};
  for (const row of standings ?? []) {
    const letter = groupLetterOf(row.group_name);
    if (letter && row.team_name_fr) teamToGroup[row.team_name_fr] = letter;
  }

  // Resolve a real group letter for a group-stage match, or null if unknown.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolveGroup = (m: any): string | null =>
    groupLetterOf(m.stage) ?? teamToGroup[m.team_a] ?? teamToGroup[m.team_b] ?? null;

  // Group matches by phase then by real group (for the group phase)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byPhase: Record<string, { stage?: string; matches: any[] }[]> = {};

  for (const m of matches ?? []) {
    const phase = m.phase ?? "Groupe";
    if (!byPhase[phase]) byPhase[phase] = [];

    if (phase === "Groupe") {
      const letter = resolveGroup(m);
      // Only label a real pool ("Groupe A"). If unknown, leave stage undefined
      // so views show a generic "Phase de groupes" — never a meaningless number.
      const stage = letter ? `Groupe ${letter}` : undefined;
      let bucket = byPhase[phase].find((b) => b.stage === stage);
      if (!bucket) {
        bucket = { stage, matches: [] };
        byPhase[phase].push(bucket);
      }
      bucket.matches.push(m);
    } else {
      let bucket = byPhase[phase].find((b) => !b.stage);
      if (!bucket) {
        bucket = { matches: [] };
        byPhase[phase].push(bucket);
      }
      bucket.matches.push(m);
    }
  }

  // Sort groups alphabetically; the unlabelled bucket (if any) goes last
  if (byPhase["Groupe"]) {
    byPhase["Groupe"].sort((a, b) =>
      (a.stage ?? "￿").localeCompare(b.stage ?? "￿")
    );
  }

  // Group standings by group_name
  const standingsByGroup: Record<string, typeof standings> = {};
  for (const row of standings ?? []) {
    const g = row.group_name ?? "Group A";
    if (!standingsByGroup[g]) standingsByGroup[g] = [];
    standingsByGroup[g].push(row);
  }

  const phases = PHASE_ORDER.filter((p) => byPhase[p]?.length).map((p) => ({
    phase: p,
    groups: byPhase[p],
  }));

  return NextResponse.json(
    { phases, standings: standingsByGroup },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } }
  );
}
