// POST /api/admin/reset-scores
// Remet à zéro tous les scores du tournoi :
//   - matches         : score_a/b → NULL, status → upcoming
//   - player_match_stats : DELETE toutes les lignes
//   - predictions     : points_awarded → 0, prediction_result → NULL
//   - bonus_predictions: points_awarded → 0
//   - quiz_answers    : points_awarded → 0
//   - score_events    : DELETE toutes les lignes
//   - babyfoot_matches: score_a/b → NULL, status → upcoming
// Réservé aux admin/super_admin. Irréversible.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function callerIsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("allowlist_users")
    .select("role, is_active")
    .eq("email", user.email)
    .single();
  return !!data?.is_active && ["admin", "super_admin"].includes(data.role ?? "");
}

export async function POST() {
  if (!(await callerIsAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const db = createAdminClient();
  const results: Record<string, string> = {};

  // 1. Matchs foot — reset scores + statut
  {
    const { error, count } = await db
      .from("matches")
      .update({ score_a: null, score_b: null, status: "upcoming", is_settled: false }, { count: "exact" })
      .neq("status", "upcoming");
    results.matches = error ? `ERREUR: ${error.message}` : `OK (${count ?? "?"} ligne(s) mise(s) à jour)`;
  }

  // 2. Stats joueurs match
  {
    const { error, count } = await db
      .from("player_match_stats")
      .delete({ count: "exact" })
      .gte("created_at", "2000-01-01");
    results.player_match_stats = error ? `ERREUR: ${error.message}` : `OK (${count ?? "?"} ligne(s) supprimée(s))`;
  }

  // 3. Pronostics matchs — reset points seulement, garde les choix
  {
    const { error, count } = await db
      .from("predictions")
      .update({ points_awarded: 0, prediction_result: null }, { count: "exact" })
      .gte("created_at", "2000-01-01");
    results.predictions = error ? `ERREUR: ${error.message}` : `OK (${count ?? "?"} ligne(s) mise(s) à jour)`;
  }

  // 4. Pronostics bonus — NON MODIFIÉS (vainqueur + buteur conservés)
  results.bonus_predictions = "ignoré (conservé tel quel)";

  // 5. Réponses quiz — reset points seulement
  {
    const { error, count } = await db
      .from("quiz_answers")
      .update({ points_awarded: 0 }, { count: "exact" })
      .gte("created_at", "2000-01-01");
    results.quiz_answers = error ? `ERREUR: ${error.message}` : `OK (${count ?? "?"} ligne(s) mise(s) à jour)`;
  }

  // 6. Événements de score (challenges, animations, babyfoot points)
  {
    const { error, count } = await db
      .from("score_events")
      .delete({ count: "exact" })
      .gte("created_at", "2000-01-01");
    results.score_events = error ? `ERREUR: ${error.message}` : `OK (${count ?? "?"} ligne(s) supprimée(s))`;
  }

  // 7. Matchs babyfoot — reset scores + statut
  {
    const { error, count } = await db
      .from("babyfoot_matches")
      .update({ score_a: null, score_b: null, status: "upcoming" }, { count: "exact" })
      .eq("status", "finished");
    results.babyfoot_matches = error ? `ERREUR: ${error.message}` : `OK (${count ?? "?"} ligne(s) mise(s) à jour)`;
  }

  const hasError = Object.values(results).some((v) => v.startsWith("ERREUR"));

  return NextResponse.json(
    { success: !hasError, results },
    { status: hasError ? 500 : 200 }
  );
}
