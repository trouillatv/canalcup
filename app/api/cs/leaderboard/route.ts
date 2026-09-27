// GET /api/cs/leaderboard
// Classement INDIVIDUEL uniquement (Lot 3D) — agrégat sum(points_awarded)
// par utilisateur sur predictions.status='settled'. Pas d'agrégation
// boutique/service dans ce lot (viendra via memberships/organizations une
// fois la chaîne individuelle prouvée exacte, décision explicite de
// l'utilisateur).
//
// La RLS "Lecture predictions propres" (Lot 3B) scope chaque utilisateur à
// ses propres lignes — impossible d'agréger tous les utilisateurs avec le
// client authentifié. Cette route utilise donc le client admin pour la
// seule lecture agrégée (points + nom affiché), jamais pour écrire ; la
// route reste protégée par le gate auth+allowlist de middleware.ts.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SettledRow = {
  user_id: string;
  points_awarded: number;
  users: { id: string; name: string; display_name: string | null } | { id: string; name: string; display_name: string | null }[];
};

function one<T>(rel: T | T[]): T {
  return Array.isArray(rel) ? rel[0] : rel;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("predictions")
    .select("user_id, points_awarded, users!inner(id, name, display_name)")
    .eq("status", "settled");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totals = new Map<string, { user_id: string; name: string; points: number }>();
  for (const row of (rows ?? []) as SettledRow[]) {
    const u = one(row.users);
    const existing = totals.get(row.user_id);
    const points = row.points_awarded ?? 0;
    if (existing) {
      existing.points += points;
    } else {
      totals.set(row.user_id, { user_id: row.user_id, name: u.display_name || u.name, points });
    }
  }

  const leaderboard = Array.from(totals.values()).sort((a, b) => b.points - a.points);

  return NextResponse.json({ leaderboard });
}
