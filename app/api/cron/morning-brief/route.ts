// Cron quotidien — génère la Matinale à partir de VRAIES données Supabase
// puis la stocke (1 ligne / jour, réutilisée par tous : règle « génère une
// fois, stocke, réutilise »). Vercel Cron : "0 19 * * *" (≈ 6h NC).
//
// Idempotent : si la matinale du jour existe déjà, on ne régénère pas
// (évite double coût Gemini / écrasement).
//
// Texte (title/body/fail/fun_fact/ai_comment) : Gemini si MOCK_AI=false +
// GEMINI_API_KEY, sinon MOCK. scores_summary / leaderboard_summary viennent
// TOUJOURS des vraies données (calculées ici), indépendamment du MOCK.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMorningBrief } from "@/services/ai/generators/morning-brief";
import { broadcastInboxEvent } from "@/lib/data/inbox";
import { computeTeamScores } from "@/lib/data/teams";
import { runCron } from "@/lib/monitoring/cron-log";
import { getSessionTotal } from "@/services/ai/cost-tracker";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  return runCron("morning-brief", async () => {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const costBefore = getSessionTotal();

  // Déjà générée aujourd'hui → on renvoie l'existante (idempotent).
  const { data: existing } = await supabase
    .from("morning_briefs").select("id").eq("date", today).maybeSingle();
  if (existing) {
    return { meta: { date: today, skipped: "already exists" } };
  }

  // ── Contexte réel ──────────────────────────────────────────────────────────
  const since = new Date(Date.now() - 36 * 3600_000).toISOString();

  const { data: finished } = await supabase
    .from("matches")
    .select("team_a, team_b, score_a, score_b, starts_at")
    .eq("status", "finished")
    .gte("starts_at", since)
    .order("starts_at", { ascending: true });

  const scoresSummary = finished?.length
    ? finished
        .map((m) => `${m.team_a} ${m.score_a ?? 0}–${m.score_b ?? 0} ${m.team_b}`)
        .join(" · ")
    : "Pas encore de match joué — le tournoi n'a pas commencé.";

  // Classement = score CALCULÉ (source unique), jamais teams.total_points
  // (dette de seed). Même agrégateur que getLeaderboard / les pages équipes.
  const { data: allTeams } = await supabase.from("teams").select("id, name");
  const scores = await computeTeamScores(supabase, (allTeams ?? []).map((t) => t.id));
  const ranked = (allTeams ?? [])
    .map((t) => ({ name: t.name, total: scores.get(t.id)?.total ?? 0 }))
    .sort((a, b) => b.total - a.total);

  const leaderboardSummary = ranked.some((t) => t.total > 0)
    ? ranked.slice(0, 5).map((t, i) => `${i + 1}. ${t.name} (${t.total} pts)`).join("  ")
    : "Classement à venir — aucun point distribué.";

  const failTeam = ranked.length > 1 ? ranked[ranked.length - 1].name : "—";

  const { data: nextMatch } = await supabase
    .from("matches")
    .select("team_a, team_b, starts_at")
    .eq("status", "upcoming")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const matchTonight = nextMatch
    ? `${nextMatch.team_a} vs ${nextMatch.team_b}`
    : "Aucun match au programme dans l'immédiat.";

  // Mode PRÉ-TOURNOI : aucun match Canal Cup n'a encore été joué.
  // → on bascule sur un prompt dédié (hype + règles + fun fact ouverture WC)
  //   au lieu du prompt classique qui suppose des scores à commenter.
  const noMatchYet = (finished?.length ?? 0) === 0;
  let preLaunch: { matchOpener: string; teamsCount: number } | undefined;
  if (noMatchYet) {
    // Match d'ouverture de la WC2026 = 1er match upcoming dans matches
    const { data: opener } = await supabase
      .from("matches")
      .select("team_a, team_b, starts_at")
      .eq("status", "upcoming")
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const openerStr = opener
      ? `${opener.team_a} vs ${opener.team_b} le ${new Date(opener.starts_at).toLocaleString("fr-FR", {
          timeZone: "Pacific/Noumea",
          day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
        })} (heure NC)`
      : "le match d'ouverture";
    const { count: teamsCount } = await supabase
      .from("teams")
      .select("*", { count: "exact", head: true });
    preLaunch = { matchOpener: openerStr, teamsCount: teamsCount ?? 0 };
  }

  // ── Génération (Gemini ou MOCK) ────────────────────────────────────────────
  const brief = await generateMorningBrief({
    date: today,
    scores: scoresSummary,
    leaderboard: leaderboardSummary,
    failTeam,
    matchTonight,
    preLaunch,
  });

  // ── Persistance (1 ligne / jour) ───────────────────────────────────────────
  const { error: upsertError } = await supabase.from("morning_briefs").upsert(
    {
      date: today,
      title: brief.title,
      body: brief.body,
      scores_summary: scoresSummary,
      leaderboard_summary: leaderboardSummary,
      fail_of_day: brief.fail_of_day,
      fun_fact: brief.fun_fact,
      ai_comment: brief.ai_comment,
    },
    { onConflict: "date" }
  );

  if (upsertError) {
    throw new Error(`Erreur persistance : ${upsertError.message}`);
  }

  // Producteur inbox : 1 courrier 'matinale' par utilisateur. S'exécute une
  // seule fois par jour grâce à l'early-return idempotent ci-dessus.
  const notified = await broadcastInboxEvent({
    type: "matinale",
    title: brief.title,
    message: brief.fun_fact || brief.body.slice(0, 140),
  });

  return {
    meta: {
      date: today,
      persisted: true,
      notified,
      gemini_cost_eur: Math.max(0, getSessionTotal() - costBefore),
    },
  };
  });
}
