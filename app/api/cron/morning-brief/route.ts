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

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Déjà générée aujourd'hui → on renvoie l'existante (idempotent).
  const { data: existing } = await supabase
    .from("morning_briefs").select("id").eq("date", today).maybeSingle();
  if (existing) {
    return NextResponse.json({ success: true, date: today, skipped: "already exists" });
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

  // ── Génération (Gemini ou MOCK) ────────────────────────────────────────────
  let brief;
  try {
    brief = await generateMorningBrief({
      date: today,
      scores: scoresSummary,
      leaderboard: leaderboardSummary,
      failTeam,
      matchTonight,
    });
  } catch (error) {
    console.error("[CRON morning-brief] génération KO", error);
    return NextResponse.json({ error: "Erreur génération" }, { status: 500 });
  }

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
    console.error("[CRON morning-brief] upsert KO", upsertError);
    return NextResponse.json(
      { error: "Erreur persistance", details: upsertError.message },
      { status: 500 }
    );
  }

  // Producteur inbox : 1 courrier 'matinale' par utilisateur. S'exécute une
  // seule fois par jour grâce à l'early-return idempotent ci-dessus.
  const notified = await broadcastInboxEvent({
    type: "matinale",
    title: brief.title,
    message: brief.fun_fact || brief.body.slice(0, 140),
  });

  console.log(
    `[CRON morning-brief] matinale ${today} générée + stockée — ${notified} courriers inbox`
  );
  return NextResponse.json({ success: true, date: today, persisted: true, notified });
}
