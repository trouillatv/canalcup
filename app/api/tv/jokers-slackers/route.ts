// GET /api/tv/jokers-slackers — écran TV "Wall of Shame" des jokers : qui n'a
// pas (ou peu) utilisé ses jokers. Public (comme /api/tv).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminEmails } from "@/lib/data/roles";

export async function GET() {
  const admin = createAdminClient();

  const [{ data: wallets }, { data: plays }, { data: users }, adminEmails] = await Promise.all([
    admin.from("joker_wallets").select("user_id, quantity"),
    admin.from("joker_plays").select("played_by_user_id").neq("status", "cancelled"),
    admin.from("users").select("id, display_name, name, email"),
    getAdminEmails(),
  ]);

  const nameById = new Map(
    (users ?? []).map((u) => [u.id, (u.display_name?.trim() || u.name?.trim() || "Joueur")])
  );
  const isAdminUser = new Map(
    (users ?? []).map((u) => [u.id, adminEmails.has((u.email ?? "").toLowerCase())])
  );

  // Jokers restants (non joués) par utilisateur.
  const unused = new Map<string, number>();
  for (const w of wallets ?? []) {
    unused.set(w.user_id, (unused.get(w.user_id) ?? 0) + (w.quantity ?? 0));
  }
  // Nombre de jokers déjà joués par utilisateur.
  const played = new Map<string, number>();
  for (const p of plays ?? []) {
    if (!p.played_by_user_id) continue;
    played.set(p.played_by_user_id, (played.get(p.played_by_user_id) ?? 0) + 1);
  }

  // Joueurs ayant un wallet (donc concernés), hors admins.
  const ids = new Set<string>([...unused.keys()]);
  const rows = [...ids]
    .filter((id) => !isAdminUser.get(id))
    .map((id) => ({
      name: nameById.get(id) ?? "Joueur",
      unused: unused.get(id) ?? 0,
      played: played.get(id) ?? 0,
    }));

  const totalPlayers = rows.length;
  // Les "jamais joué" : 0 joker utilisé. Triés par jokers dormants (desc).
  const neverPlayed = rows
    .filter((r) => r.played === 0)
    .sort((a, b) => b.unused - a.unused);
  // Ceux qui en ont joué au moins un mais en gardent sous le coude.
  const partial = rows
    .filter((r) => r.played > 0 && r.unused > 0)
    .sort((a, b) => b.unused - a.unused);

  const totalUnused = rows.reduce((s, r) => s + r.unused, 0);
  const totalPlayed = rows.reduce((s, r) => s + r.played, 0);

  return NextResponse.json(
    {
      neverPlayed,
      partial,
      stats: {
        totalPlayers,
        neverPlayedCount: neverPlayed.length,
        totalUnused,
        totalPlayed,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
