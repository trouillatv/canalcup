import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PHASE_ORDER = ["Groupe", "Huitièmes", "Quarts", "Demis", "3ème place", "Finale"];

export async function GET() {
  const supabase = createAdminClient();

  const [{ data: matchesRaw }, { data: standings }] = await Promise.all([
    supabase.from("matches").select("*").order("starts_at", { ascending: true }),
    supabase.from("standings").select("*").order("points", { ascending: false }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches: any[] = matchesRaw ?? [];

  // Group matches by phase then by stage (for groups)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byPhase: Record<string, { stage?: string; matches: any[] }[]> = {};

  for (const m of matches ?? []) {
    const phase = m.phase ?? "Groupe";
    if (!byPhase[phase]) byPhase[phase] = [];

    if (phase === "Groupe") {
      const stage = m.stage ?? "Groupe A";
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

  // Sort groups alphabetically within group phase
  if (byPhase["Groupe"]) {
    byPhase["Groupe"].sort((a, b) => (a.stage ?? "").localeCompare(b.stage ?? ""));
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
