import { callGemini } from "@/services/ai/gemini";
import { PROMPTS } from "@/services/ai/prompts";
import { recordCost } from "@/services/ai/cost-tracker";
import { createAdminClient } from "@/lib/supabase/admin";

interface MatchStoryContext {
  matchId: string;
  teamA: string;
  flagA: string;
  teamB: string;
  flagB: string;
  scoreA: number;
  scoreB: number;
  phase: string;
}

interface StoryResult {
  phrase: string;
  emoji: string;
}

const MOCK_STORIES: StoryResult[] = [
  { phrase: "Personne ne l'avait vu venir. Le score non plus.", emoji: "🤯" },
  { phrase: "Les pronostics ont survécu, contrairement à l'espoir de certains.", emoji: "📊" },
  { phrase: "Un résultat qui divise le bureau en deux camps : ceux qui avaient raison et les autres.", emoji: "⚽" },
  { phrase: "Le foot reste imprévisible. Le classement Canal Cup, un peu moins.", emoji: "🏆" },
];

async function computePredictionStats(matchId: string, scoreA: number, scoreB: number) {
  const supabase = createAdminClient();

  const { data: predictions } = await supabase
    .from("predictions")
    .select("predicted_score_a, predicted_score_b, points_awarded, team_id, teams(name)")
    .eq("match_id", matchId);

  if (!predictions?.length) return null;

  const totalPredictors = predictions.length;
  const exactScores = predictions.filter(
    (p) => p.predicted_score_a === scoreA && p.predicted_score_b === scoreB
  ).length;

  const winnerA = scoreA > scoreB, winnerB = scoreB > scoreA;
  const correctResults = predictions.filter((p) => {
    const pa = p.predicted_score_a ?? 0, pb = p.predicted_score_b ?? 0;
    return (pa > pb) === winnerA && (pb > pa) === winnerB;
  }).length;

  // Points by team
  const teamPoints: Record<string, { name: string; total: number; count: number; exact: number }> = {};
  for (const p of predictions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamName = (p as any).teams?.name ?? "Inconnu";
    const tid = String(p.team_id ?? teamName);
    if (!teamPoints[tid]) teamPoints[tid] = { name: teamName, total: 0, count: 0, exact: 0 };
    teamPoints[tid].total += p.points_awarded ?? 0;
    teamPoints[tid].count += 1;
    if (p.predicted_score_a === scoreA && p.predicted_score_b === scoreB) teamPoints[tid].exact += 1;
  }

  const sorted = Object.values(teamPoints).sort((a, b) => b.total - a.total);
  const bestTeam = sorted[0]?.total > 0 ? sorted[0].name : null;
  const worstTeam = sorted.length > 1 ? sorted[sorted.length - 1].name : null;
  const topExactTeam = sorted.find((t) => t.exact > 0)?.name ?? null;

  return { totalPredictors, exactScores, correctResults, bestTeam, worstTeam, topExactTeam };
}

export async function generateMatchStory(ctx: MatchStoryContext): Promise<void> {
  const supabase = createAdminClient();

  // Don't regenerate if already exists
  const { data: existing } = await supabase
    .from("match_stories")
    .select("id")
    .eq("match_id", ctx.matchId)
    .single();

  if (existing) return;

  const stats = await computePredictionStats(ctx.matchId, ctx.scoreA, ctx.scoreB);

  let result: StoryResult;
  let statsJson = stats ?? {};

  if (process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    result = MOCK_STORIES[Math.floor(Math.random() * MOCK_STORIES.length)];
  } else {
    const prompt = PROMPTS.matchStory({
      teamA: ctx.teamA,
      flagA: ctx.flagA ?? "",
      teamB: ctx.teamB,
      flagB: ctx.flagB ?? "",
      scoreA: ctx.scoreA,
      scoreB: ctx.scoreB,
      phase: ctx.phase ?? "Groupe",
      totalPredictors: stats?.totalPredictors ?? 0,
      exactScores: stats?.exactScores ?? 0,
      correctResults: stats?.correctResults ?? 0,
      bestTeam: stats?.bestTeam ?? null,
      worstTeam: stats?.worstTeam ?? null,
      topExactTeam: stats?.topExactTeam ?? null,
    });

    const geminiResult = await callGemini<StoryResult>(prompt);
    recordCost("match_story", geminiResult.tokens, geminiResult.estimatedCostEur);
    result = geminiResult.data;
    statsJson = { ...statsJson, tokens: geminiResult.tokens, cost_eur: geminiResult.estimatedCostEur };
  }

  const phrase = result.phrase ?? "Match terminé.";
  const emoji = result.emoji ?? "⚽";

  await supabase.from("match_stories").upsert(
    {
      match_id: ctx.matchId,
      phrase,
      stats_json: statsJson,
    },
    { onConflict: "match_id" }
  );

  // Publier aussi dans le live cup sous forme de commentaire "Le Goat"
  await supabase.from("feed_posts").insert({
    type: "robert",
    context_type: "match",
    context_id: ctx.matchId,
    display_name: "Le Goat",
    body: `${emoji} **${ctx.teamA} ${ctx.scoreA}–${ctx.scoreB} ${ctx.teamB}** — ${phrase}`,
    status: "visible",
  }).then(({ error }) => {
    if (error) console.error(`[match-story] feed_posts insert failed: ${error.message}`);
  });

  console.log(`[match-story] match=${ctx.matchId} story generated + posted to live cup`);
}
