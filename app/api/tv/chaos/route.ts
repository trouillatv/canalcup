// GET /api/tv/chaos — données de l'écran TV "Chaos" : derniers jokers joués,
// effets actifs (Brouillard / Retard / Cartons), résultats Casino & Quitte ou
// Double. Public (comme /api/tv).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllActiveEffects, expireStaleEffects } from "@/lib/jokers/service";

export async function GET() {
  const admin = createAdminClient();
  await expireStaleEffects(admin);

  const [{ data: plays }, effects] = await Promise.all([
    admin
      .from("joker_plays")
      .select("id, joker_type, played_by_user_id, target_user_id, match_id, status, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
    getAllActiveEffects(),
  ]);

  // Noms + matchs référencés
  const userIds = new Set<string>();
  const matchIds = new Set<string>();
  for (const p of plays ?? []) {
    userIds.add(p.played_by_user_id);
    if (p.target_user_id) userIds.add(p.target_user_id);
    if (p.match_id) matchIds.add(p.match_id);
  }
  for (const e of effects) {
    userIds.add(e.affected_user_id);
    if (e.match_id) matchIds.add(e.match_id);
  }

  const [{ data: users }, { data: matches }] = await Promise.all([
    userIds.size
      ? admin.from("users").select("id, display_name, name").in("id", [...userIds])
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; name: string | null }[] }),
    matchIds.size
      ? admin.from("matches").select("id, team_a, team_b").in("id", [...matchIds])
      : Promise.resolve({ data: [] as { id: string; team_a: string; team_b: string }[] }),
  ]);

  const nameById = new Map((users ?? []).map((u) => [u.id, u.display_name?.trim() || u.name?.trim() || "Joueur"]));
  const matchById = new Map((matches ?? []).map((m) => [m.id, `${m.team_a} – ${m.team_b}`]));

  const recentPlays = (plays ?? []).map((p) => ({
    id: p.id,
    jokerType: p.joker_type,
    playerName: nameById.get(p.played_by_user_id) ?? "Joueur",
    targetName: p.target_user_id ? nameById.get(p.target_user_id) ?? "Joueur" : null,
    matchLabel: p.match_id ? matchById.get(p.match_id) ?? null : null,
    metadata: p.metadata ?? {},
    status: p.status,
    createdAt: p.created_at,
  }));

  const fog = effects
    .filter((e) => e.effect_type === "fog")
    .map((e) => ({ name: nameById.get(e.affected_user_id) ?? "Joueur", endsAt: e.ends_at }));
  const flightDelay = effects
    .filter((e) => e.effect_type === "flight_delay")
    .map((e) => ({ name: nameById.get(e.affected_user_id) ?? "Joueur", endsAt: e.ends_at }));
  const redCards = effects
    .filter((e) => e.effect_type === "red_card_block")
    .map((e) => ({
      name: nameById.get(e.affected_user_id) ?? "Joueur",
      matchLabel: e.match_id ? matchById.get(e.match_id) ?? null : null,
    }));

  return NextResponse.json(
    { recentPlays, fog, flightDelay, redCards },
    { headers: { "Cache-Control": "no-store" } }
  );
}
