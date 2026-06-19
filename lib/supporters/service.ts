// ─────────────────────────────────────────────────────────────────────────────
//  Service Journée Supporters — logique serveur (createAdminClient).
//  Points = animation perso → score_events catégorie 'social' (pilier
//  Animations 25 %), une ligne par membre du binôme. JAMAIS teams.total_points.
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export const PARTICIPATION_POINTS = 10;
export const PODIUM_POINTS: Record<number, number> = { 1: 40, 2: 30, 3: 20 };

/**
 * Attribue `totalPoints` à un binôme (team) via score_events, répartis entre
 * ses membres (une ligne par user → compte aussi pour le classement service).
 * Idempotent : purge d'abord les score_events précédents pour ce (source_id,
 * label) avant de réécrire → ré-exécutable sans double-comptage.
 */
export async function awardToTeam(
  admin: Admin,
  opts: { teamId: string; totalPoints: number; label: string; sourceId: string; description?: string }
): Promise<void> {
  const { teamId, totalPoints, label, sourceId, description } = opts;

  // Purge d'un éventuel award précédent identique (anti double-attribution).
  await admin
    .from("score_events")
    .delete()
    .eq("source_type", "award")
    .eq("source_id", sourceId)
    .eq("label", label);

  if (totalPoints === 0) return;

  // Membres du binôme.
  const { data: members } = await admin
    .from("users")
    .select("id")
    .eq("team_id", teamId);
  const ids = (members ?? []).map((m) => m.id);

  if (ids.length === 0) {
    // Pas de membre identifié : on crédite la team sans user_id (compte pour
    // le score d'équipe, pas pour le classement service).
    await admin.from("score_events").insert({
      team_id: teamId, user_id: null, category: "social", source_type: "award",
      source_id: sourceId, raw_points: totalPoints, label, description: description ?? null,
    });
    return;
  }

  // Répartition entière entre membres ; le reste va au premier (total exact).
  const base = Math.floor(totalPoints / ids.length);
  const remainder = totalPoints - base * ids.length;
  const rows = ids.map((uid, i) => ({
    team_id: teamId,
    user_id: uid,
    category: "social" as const,
    source_type: "award" as const,
    source_id: sourceId,
    raw_points: base + (i === 0 ? remainder : 0),
    label,
    description: description ?? null,
  }));
  await admin.from("score_events").insert(rows);
}

/** Retire les points d'un award (ex. photo masquée après validation). */
export async function revokeAward(
  admin: Admin,
  opts: { sourceId: string; label: string }
): Promise<void> {
  await admin
    .from("score_events")
    .delete()
    .eq("source_type", "award")
    .eq("source_id", opts.sourceId)
    .eq("label", opts.label);
}

export const PARTICIPATION_LABEL = "Journée Supporters — Participation";
export function podiumLabel(rank: number): string {
  const place = rank === 1 ? "1re place 🥇" : rank === 2 ? "2e place 🥈" : "3e place 🥉";
  return `Journée Supporters — ${place}`;
}
