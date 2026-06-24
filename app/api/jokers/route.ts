// GET /api/jokers — wallet du joueur courant + effets actifs sur lui +
// données nécessaires pour jouer (joueurs ciblables, matchs à venir).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWallet, getActiveEffectsForUser } from "@/lib/jokers/service";
import { getAdminEmails } from "@/lib/data/roles";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [wallet, effects, adminEmails] = await Promise.all([
    getWallet(me.id),
    getActiveEffectsForUser(me.id),
    getAdminEmails(),
  ]);

  // Joueurs ciblables (hors admins, hors soi)
  const { data: usersRaw } = await admin
    .from("users")
    .select("id, display_name, name, email")
    .eq("profile_completed", true);
  const players = (usersRaw ?? [])
    .filter((u) => u.id !== me.id && !adminEmails.has((u.email ?? "").toLowerCase()))
    .map((u) => ({ id: u.id, name: u.display_name?.trim() || u.name?.trim() || "Joueur" }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  // Matchs à venir (ciblables / jouables)
  const { data: matchesRaw } = await admin
    .from("matches")
    .select("id, team_a, team_b, starts_at, status, phase")
    .in("status", ["upcoming", "live", "halftime"])
    .order("starts_at", { ascending: true })
    .limit(60);

  // Mes plays récents — enrichis du match (libellé + score live/final) pour que
  // l'historique dise « sur quel match » et le score actuel de ce match.
  const { data: myPlays } = await admin
    .from("joker_plays")
    .select("id, joker_type, target_user_id, match_id, status, metadata, created_at")
    .eq("played_by_user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const playMatchIds = [...new Set((myPlays ?? []).map((p) => p.match_id).filter(Boolean) as string[])];
  const matchById = new Map<string, { team_a: string; team_b: string; score_a: number | null; score_b: number | null; status: string }>();
  if (playMatchIds.length) {
    const { data: pm } = await admin
      .from("matches")
      .select("id, team_a, team_b, score_a, score_b, status")
      .in("id", playMatchIds);
    for (const m of pm ?? []) matchById.set(m.id, m);
  }
  const myPlaysEnriched = (myPlays ?? []).map((p) => ({
    ...p,
    match: p.match_id ? matchById.get(p.match_id) ?? null : null,
  }));

  // 🛬 Jet Lag : effet CACHÉ — la victime ne doit pas le voir dans ses effets
  // actifs (elle ne le découvre qu'au coup de sifflet final). On le retire ici.
  const visibleEffects = effects.filter((e) => e.effect_type !== "jet_lag");

  return NextResponse.json(
    { userId: me.id, wallet, effects: visibleEffects, players, matches: matchesRaw ?? [], myPlays: myPlaysEnriched },
    { headers: { "Cache-Control": "no-store" } }
  );
}
