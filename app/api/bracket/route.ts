import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toFrench } from "@/lib/football/team-names";
import { groupLetterForTeam, officialTeamFr } from "@/lib/football/groups-2026";

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

  // Normalise un libellé fournisseur non traduit ("Czechia" → "République
  // Tchèque") : noms + drapeaux corrects sur le bracket, et rattachement au bon
  // groupe (les standings utilisent déjà le nom français).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches: any[] = (matchesRaw ?? []).map((m: any) => ({
    ...m,
    team_a: toFrench(m.team_a),
    team_b: toFrench(m.team_b),
  }));

  // Pool d'un match : on s'appuie sur le TIRAGE OFFICIEL (WC2026_GROUPS) via le
  // nom des équipes — source unique de vérité, immunisée contre les libellés
  // `group_name` pollués/dupliqués des fournisseurs (cf. fallback "Group A").
  // match.stage est souvent un numéro de journée → ignoré pour le rattachement.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolveGroup = (m: any): string | null =>
    groupLetterForTeam(m.team_a) ?? groupLetterForTeam(m.team_b) ?? null;

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

  // Classement par poule — RECONSTRUIT depuis le tirage officiel, pas depuis le
  // `group_name` du fournisseur (pollué : doublons, fallback "Group A" à 9
  // équipes, conventions mêlées "Group A" / "Group Stage - Group A"). On rattache
  // chaque ligne à sa vraie poule via le nom d'équipe, on déduplique en gardant
  // la plus à jour (plus de matchs joués), et on normalise le nom FR.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bestByTeam: Record<string, any> = {};
  for (const row of standings ?? []) {
    const letter = groupLetterForTeam(row.team_name_fr);
    if (!letter) continue; // ligne hors 48 (3es de groupe, garbage) → ignorée
    const canonFr = officialTeamFr(row.team_name_fr) ?? row.team_name_fr;
    const key = `${letter}|${canonFr}`;
    const prev = bestByTeam[key];
    if (!prev || (row.played ?? 0) > (prev.played ?? 0)) {
      bestByTeam[key] = { ...row, team_name_fr: canonFr, _letter: letter };
    }
  }
  const standingsByGroup: Record<string, typeof standings> = {};
  for (const row of Object.values(bestByTeam)) {
    const g = `Groupe ${row._letter}`;
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
