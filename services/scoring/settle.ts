// Settlement engine — calculates points for all predictions on finished matches
// Called by cron after syncLiveScores(), and by admin trigger

import { createAdminClient } from "@/lib/supabase/admin";
import { calculatePoints } from "@/lib/scoring";
import { generateMatchStory } from "@/services/ai/generators/match-story";
import { createFlash } from "@/lib/tv/flash";
import { resolveQuitteOuDoubleForMatch, resolveKamikazeForMatch, resolveJetLagForMatch } from "@/lib/jokers/service";
import { sendPushToUser } from "@/lib/push";

// ─── Settle a single match ────────────────────────────────────────────────────

export async function settleMatch(matchId: string): Promise<{ settled: number; skipped: boolean }> {
  const supabase = createAdminClient();

  // Atomic claim: only settle if not already settled
  const { data: claimed } = await supabase
    .from("matches")
    .update({ is_settled: true })
    .eq("id", matchId)
    .eq("is_settled", false)
    .eq("status", "finished")
    .select("id, phase, score_a, score_b, score_ht_a, score_ht_b, team_a, team_b, flag_a, flag_b")
    .single();

  // Another process already settled this match, or it's not finished/scores missing
  if (!claimed || claimed.score_a === null || claimed.score_b === null) {
    return { settled: 0, skipped: true };
  }

  const match = claimed;

  // Fetch all predictions for this match
  const { data: predictions } = await supabase
    .from("predictions")
    .select("id, user_id, predicted_score_a, predicted_score_b")
    .eq("match_id", matchId);

  if (!predictions?.length) return { settled: 0, skipped: false };

  // Calculate and batch-update points
  const updates = predictions.map((p) => ({
    id: p.id,
    points_awarded: calculatePoints(
      // Pass minimal match shape required by calculatePoints
      { phase: match.phase, score_a: match.score_a, score_b: match.score_b } as Parameters<typeof calculatePoints>[0],
      p.predicted_score_a ?? 0,
      p.predicted_score_b ?? 0
    ),
  }));

  for (const u of updates) {
    await supabase.from("predictions").update({ points_awarded: u.points_awarded }).eq("id", u.id);
  }

  // 💥 Quitte ou Double : écrase les points des joueurs ayant joué ce joker sur
  // ce match (score exact = +25, bon vainqueur = +20, raté = −10). Doit passer
  // APRÈS le calcul de base.
  await resolveQuitteOuDoubleForMatch(supabase, matchId, match.score_a!, match.score_b!).catch((e) =>
    console.error(`[settle] quitte_ou_double failed for match=${matchId}`, e)
  );

  // 💣 Kamikaze : score exact = +30, bon résultat = 0, raté = −15. Comme QouD,
  // écrase les points du prono concerné — donc APRÈS le calcul de base.
  await resolveKamikazeForMatch(supabase, matchId, match.score_a!, match.score_b!).catch((e) =>
    console.error(`[settle] kamikaze failed for match=${matchId}`, e)
  );

  // 🛬 Jet Lag : re-juge le prono des victimes sur la SEULE 2e mi-temps
  // (= plein temps − mi-temps). Écrase les points → APRÈS le calcul de base.
  await resolveJetLagForMatch(supabase, {
    id: matchId,
    phase: match.phase,
    score_a: match.score_a!,
    score_b: match.score_b!,
    score_ht_a: match.score_ht_a,
    score_ht_b: match.score_ht_b,
  }).catch((e) => console.error(`[settle] jet_lag failed for match=${matchId}`, e));

  // Check perfect streak for each user who had a prediction on this match
  const userIds = [...new Set(predictions.map((p) => p.user_id))];
  await Promise.all(userIds.map((uid) => checkPerfectStreak(uid)));

  // Flash TV — score exact détecté (fire-and-forget)
  const exactCount = predictions.filter(
    (p) => p.predicted_score_a === match.score_a && p.predicted_score_b === match.score_b
  ).length;
  if (exactCount > 0) {
    createFlash(
      "score_exact",
      "⚡ SCORE EXACT DÉTECTÉ",
      `${exactCount} équipe${exactCount > 1 ? "s ont" : " a"} vu juste : ${match.score_a}-${match.score_b}`,
      "⚡",
      8
    ).catch(() => {});
  }

  // 🔥 Notif NARRATIVE « tu es le seul à avoir trouvé le score » (fire-and-forget).
  // Personnelle > technique : on ne notifie QUE si le score exact est rare (≤ 3
  // personnes), pour que ça reste un moment « héros ».
  void (async () => {
    const exactPreds = predictions.filter(
      (p) => p.predicted_score_a === match.score_a && p.predicted_score_b === match.score_b
    );
    if (!exactPreds.length || exactPreds.length > 3) return;
    const n = exactPreds.length;
    const score = `${match.score_a}-${match.score_b}`;
    const url = `/matches/${matchId}?tab=pronos`;
    const { data: users } = await supabase.from("users").select("id, auth_id").in("id", exactPreds.map((p) => p.user_id));
    const authById = new Map((users ?? []).map((u: { id: string; auth_id: string | null }) => [u.id, u.auth_id]));
    for (const p of exactPreds) {
      const authId = authById.get(p.user_id);
      if (!authId) continue;
      const title = n === 1 ? "🔥 Tu es le SEUL à avoir trouvé le score !" : "🎯 Score exact rare !";
      const body = n === 1
        ? `Personne d'autre n'a vu le ${score} de ${match.team_a}-${match.team_b}. Chapeau l'oracle.`
        : `Vous n'êtes que ${n} à avoir trouvé le ${score} exact. Bien vu.`;
      await sendPushToUser(authId, { title, body, url });
    }
  })().catch((e) => console.error(`[settle] narrative push failed for match=${matchId}`, e));

  // Generate AI story post-match (fire-and-forget, never blocks settlement)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = match as any;
  generateMatchStory({
    matchId,
    teamA: m.team_a ?? "",
    flagA: m.flag_a ?? "",
    teamB: m.team_b ?? "",
    flagB: m.flag_b ?? "",
    scoreA: match.score_a!,
    scoreB: match.score_b!,
    phase: match.phase ?? "Groupe",
  }).catch((e) => console.error(`[settle] story generation failed for match=${matchId}`, e));

  console.log(`[settle] match=${matchId} settled=${updates.length} predictions`);
  return { settled: updates.length, skipped: false };
}

// ─── Check and award perfect streak bonus (+5pts) ─────────────────────────────
// A perfect streak = 3 consecutive exact scores (by match kickoff order)

async function checkPerfectStreak(userId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get user's last 3 predictions on finished+settled matches, ordered by kickoff
  const { data: rows } = await supabase
    .from("predictions")
    .select("points_awarded, predicted_score_a, predicted_score_b, match:matches(score_a, score_b, starts_at, is_settled, status, phase)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!rows?.length) return;

  // Filter to settled+finished matches only, sort by kickoff ascending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settled = (rows as any[])
    .filter((r) => r.match?.is_settled && r.match?.status === "finished")
    .sort((a, b) => new Date(a.match.starts_at).getTime() - new Date(b.match.starts_at).getTime());

  if (settled.length < 3) return;

  // Check last 3 settled predictions for exact scores
  const last3 = settled.slice(-3);
  const allExact = last3.every(
    (r) =>
      r.predicted_score_a === r.match.score_a &&
      r.predicted_score_b === r.match.score_b
  );

  if (!allExact) return;

  // Get user's team_id
  const { data: profile } = await supabase
    .from("users")
    .select("team_id")
    .eq("id", userId)
    .single();

  // Award/update the streak bonus (upsert — idempotent)
  await supabase.from("bonus_predictions").upsert(
    {
      user_id: userId,
      team_id: profile?.team_id ?? null,
      prediction_type: "perfect_streak",
      predicted_value: "3 scores exacts consécutifs",
      points_awarded: 5,
    },
    { onConflict: "user_id,prediction_type" }
  );

  console.log(`[settle] perfect_streak awarded to user=${userId}`);
}

// ─── Settle all unsettled finished matches ────────────────────────────────────

export async function settleAllFinished(): Promise<{ total: number; errors: number }> {
  const supabase = createAdminClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "finished")
    .eq("is_settled", false);

  if (!matches?.length) return { total: 0, errors: 0 };

  let total = 0;
  let errors = 0;

  for (const m of matches) {
    try {
      const { settled } = await settleMatch(m.id);
      total += settled;
    } catch (e) {
      console.error(`[settle] error on match=${m.id}`, e);
      errors++;
    }
  }

  return { total, errors };
}
