import { getMatches, getGroupStandings } from "@/lib/data/matches";
import { getLeaderboard, getIndividualLeaderboard } from "@/lib/data/teams";
import { getServiceLeaderboard } from "@/lib/data/users";
import { computeMedals } from "@/lib/data/medals";
import { getTodayBrief, getRevivezPosts } from "@/lib/data/content";
import { getChallenges } from "@/lib/data/challenges";
import { getTvPredictionHeatmap } from "@/lib/data/player";
import { getAdminEmails } from "@/lib/data/roles";
import { getHallOfShame, getVisionnaire, getDrama, getFantomes } from "@/lib/data/tv-stories";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWCTeamByName, type WCPlayer } from "@/lib/football/wc-teams";
import { AMBIANCE_STATES } from "@/lib/tv/hype";
import { NextResponse } from "next/server";
import type { Match } from "@/lib/supabase/types";

export const revalidate = 30;

// ─── Fil L'Équipe Football (RSS) ─────────────────────────────────────────────
// Fetch serveur du flux RSS football de L'Équipe (timeout court). On NE scrape
// PAS le HTML ni n'iframe (X-Frame-Options: sameorigin) — uniquement le RSS.
// L'endpoint générique /api/edito/rss ramène tous sports confondus (tennis,
// rugby, etc.) — on cible la rubrique Football avec ?path=/Football/.
async function getLequipeNews(): Promise<{ title: string; link: string }[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch("https://dwh.lequipe.fr/api/edito/rss?path=/Football/", {
      signal: ctrl.signal,
      headers: { "User-Agent": "CanalCupTV/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const xml = await res.text();

    const clean = (s: string) =>
      s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();

    const items = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
    const news: { title: string; link: string }[] = [];
    for (const item of items) {
      const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1];
      const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1];
      if (title) {
        news.push({ title: clean(title), link: link ? clean(link) : "" });
      }
      if (news.length >= 8) break;
    }
    return news;
  } catch {
    return [];
  }
}


// Joueur à surveiller d'une sélection : le plus gros buteur en sélection ;
// à défaut de stats de buts, le joueur à la plus grosse valeur marchande.
// `value` Transfermarkt est de la forme "€80.00m" / "€800k".
function parseValueEur(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.replace(/\s/g, "").match(/([\d.,]+)\s*(bn|md|m|k)?/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] ?? "").toLowerCase();
  const mult = unit === "bn" || unit === "md" ? 1e9 : unit === "m" ? 1e6 : unit === "k" ? 1e3 : 1;
  return n * mult;
}

function formatValueEur(eur: number): string {
  if (eur >= 1e9) return `${(eur / 1e9).toFixed(2).replace(".", ",")} Md€`;
  if (eur >= 1e6) return `${Math.round(eur / 1e6)} M€`;
  return `${Math.round(eur / 1e3)} k€`;
}

type WatchPlayer = {
  name: string;
  team: string;
  photo: string | null;
  reason: "goals" | "value";
  goals: number | null;
  value_label: string | null;
};

function pickWatchPlayer(teamName: string): WatchPlayer | null {
  const team = getWCTeamByName(teamName);
  if (!team || !team.players?.length) return null;

  const photoOf = (p: WCPlayer): string | null =>
    (p as WCPlayer & { photo?: string | null }).photo ?? null;

  // 1) Plus gros buteur en sélection (au moins 1 but).
  const scorers = team.players.filter((p) => (p.selection_goals ?? 0) > 0);
  if (scorers.length) {
    const best = scorers.reduce((a, b) => {
      const ga = a.selection_goals ?? 0;
      const gb = b.selection_goals ?? 0;
      if (gb !== ga) return gb > ga ? b : a;
      return (parseValueEur(b.value) ?? 0) > (parseValueEur(a.value) ?? 0) ? b : a;
    });
    return {
      name: best.name,
      team: team.name,
      photo: photoOf(best),
      reason: "goals",
      goals: best.selection_goals ?? 0,
      value_label: null,
    };
  }

  // 2) À défaut : plus grosse valeur marchande.
  const valued = team.players
    .map((p) => ({ p, eur: parseValueEur(p.value) }))
    .filter((x): x is { p: WCPlayer; eur: number } => x.eur != null);
  if (valued.length) {
    const best = valued.reduce((a, b) => (b.eur > a.eur ? b : a));
    return {
      name: best.p.name,
      team: team.name,
      photo: photoOf(best.p),
      reason: "value",
      goals: null,
      value_label: formatValueEur(best.eur),
    };
  }

  return null;
}

async function getPreMatchStats(supabase: ReturnType<typeof createAdminClient>, match: Match, totalTeams: number) {
  const [{ data: preds }, { data: bonusPreds }] = await Promise.all([
    supabase
      .from("predictions")
      .select("team_id, prediction_result, predicted_score_a, predicted_score_b")
      .eq("match_id", match.id),
    supabase
      .from("bonus_predictions")
      .select("predicted_value")
      .eq("prediction_type", "top_scorer"),
  ]);

  const rows = preds ?? [];
  const teamsPredicted = new Set(rows.map((r) => r.team_id)).size;
  const teamsMissing = Math.max(0, totalTeams - teamsPredicted);

  // Result distribution
  const votesA = rows.filter((r) => r.prediction_result === "A").length;
  const votesB = rows.filter((r) => r.prediction_result === "B").length;
  const votesDraw = rows.filter((r) => r.prediction_result === "DRAW").length;
  const total = rows.length || 1;

  const pctA = Math.round((votesA / total) * 100);
  const pctB = Math.round((votesB / total) * 100);
  const pctDraw = 100 - pctA - pctB;

  const topResult: "A" | "DRAW" | "B" | null =
    votesA >= votesB && votesA >= votesDraw ? "A"
    : votesB >= votesA && votesB >= votesDraw ? "B"
    : votesDraw > 0 ? "DRAW" : null;

  const topPct = topResult === "A" ? pctA : topResult === "B" ? pctB : pctDraw;

  // Most predicted exact score
  const scoreCounts: Record<string, number> = {};
  for (const r of rows) {
    if (r.predicted_score_a !== null && r.predicted_score_a !== undefined
        && r.predicted_score_b !== null && r.predicted_score_b !== undefined) {
      const key = `${r.predicted_score_a}-${r.predicted_score_b}`;
      scoreCounts[key] = (scoreCounts[key] ?? 0) + 1;
    }
  }
  const topScore = Object.entries(scoreCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
  const topScoreCount = topScore ? scoreCounts[topScore] : 0;
  const topScorePct = Math.round((topScoreCount / total) * 100);

  // Most predicted top scorer from bonus predictions
  const scorerCounts: Record<string, number> = {};
  for (const b of bonusPreds ?? []) {
    scorerCounts[b.predicted_value] = (scorerCounts[b.predicted_value] ?? 0) + 1;
  }
  const topScorerEntry = Object.entries(scorerCounts).sort(([, a], [, b]) => b - a)[0];
  const topScorer = topScorerEntry?.[0] ?? null;
  const topScorerTotal = (bonusPreds ?? []).length || 1;
  const topScorerPct = topScorerEntry ? Math.round((topScorerEntry[1] / topScorerTotal) * 100) : 0;

  return {
    match,
    total_teams: totalTeams,
    teams_predicted: teamsPredicted,
    teams_missing: teamsMissing,
    votes_a: votesA,
    votes_b: votesB,
    votes_draw: votesDraw,
    pct_a: pctA,
    pct_b: pctB,
    pct_draw: pctDraw,
    top_result: topResult,
    top_pct: topPct,
    top_score: topScore,
    top_score_pct: topScorePct,
    top_scorer: topScorer,
    top_scorer_pct: topScorerPct,
    watch_a: pickWatchPlayer(match.team_a),
    watch_b: pickWatchPlayer(match.team_b),
  };
}

// Compteurs du jour (created_at >= début du jour UTC) : pronos, quiz, défis.
async function getTodayStats(supabase: ReturnType<typeof createAdminClient>) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const since = dayStart.toISOString();

  const countSince = async (table: string) => {
    try {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .gte("created_at", since);
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  const [pronos, quiz, animations] = await Promise.all([
    countSince("predictions"),
    countSince("quiz_answers"),
    countSince("challenge_entries"),
  ]);
  return { pronos, quiz, animations };
}

// Nouveaux joueurs (profil complété, < 48h, non admins). On renvoie les
// display_name uniquement — jamais les emails.
async function getNewPlayers(supabase: ReturnType<typeof createAdminClient>): Promise<string[]> {
  try {
    const since = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
    const [{ data }, adminEmails] = await Promise.all([
      supabase
        .from("users")
        .select("display_name, email, created_at")
        .eq("profile_completed", true)
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
      getAdminEmails(),
    ]);
    return (data ?? [])
      .filter((u: { email: string | null }) => !adminEmails.has((u.email ?? "").toLowerCase()))
      .map((u: { display_name: string | null }) => u.display_name)
      .filter((n): n is string => !!n && n.trim().length > 0);
  } catch {
    return [];
  }
}

// Buteurs les plus pariés (bonus_predictions top_scorer), top 6, tri desc.
async function getTopScorerBets(
  supabase: ReturnType<typeof createAdminClient>
): Promise<{ name: string; count: number }[]> {
  try {
    const { data } = await supabase
      .from("bonus_predictions")
      .select("predicted_value")
      .eq("prediction_type", "top_scorer");
    const counts: Record<string, number> = {};
    for (const b of data ?? []) {
      const v = (b.predicted_value ?? "").trim();
      if (v) counts[v] = (counts[v] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  } catch {
    return [];
  }
}

// Meilleurs buteurs RÉELS du tournoi (match_events, hors csc), top 6, tri desc.
// Compte les buts marqués (goal + penalty) ; les buts contre son camp (detail
// "own") ne créditent PAS le joueur, on les ignore.
async function getTopScorers(
  supabase: ReturnType<typeof createAdminClient>
): Promise<{ name: string; count: number }[]> {
  try {
    const { data } = await supabase
      .from("match_events")
      .select("player_name, type, detail")
      .in("type", ["goal", "penalty"]);
    const counts: Record<string, number> = {};
    for (const e of data ?? []) {
      if ((e.detail ?? "").toLowerCase().includes("own")) continue; // csc → pas au buteur
      const v = (e.player_name ?? "").trim();
      if (v) counts[v] = (counts[v] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  } catch {
    return [];
  }
}

export async function GET() {
  const supabase = createAdminClient();

  const now = new Date();
  // Events window: show events from 1h ago to 24h from now
  const windowStart = new Date(now.getTime() - 60 * 60_000).toISOString();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();

  const [matches, leaderboard, individual, services, medals, brief, revivezPosts, allChallenges, news, todayStats, newPlayers, topScorerBets, heatmap, standings, { data: events }, hallofshame, visionnaire, drama, fantomes] =
    await Promise.all([
      getMatches(),
      getLeaderboard(),
      getIndividualLeaderboard(),
      getServiceLeaderboard(),
      computeMedals(),
      getTodayBrief(),
      getRevivezPosts(),
      getChallenges(),
      getLequipeNews(),
      getTodayStats(supabase),
      getNewPlayers(supabase),
      getTopScorerBets(supabase),
      getTvPredictionHeatmap().catch(() => []),
      getGroupStandings(),
      supabase
        .from("canal_cup_events")
        .select("*")
        .eq("is_active", true)
        .gte("starts_at", windowStart)
        .lte("starts_at", windowEnd)
        .order("starts_at", { ascending: true }),
      getHallOfShame(supabase),
      getVisionnaire(supabase),
      getDrama(supabase),
      getFantomes(supabase),
    ]);

  // TV slide animations : on garde live + upcoming (max 5, live en haut).
  const challengesForTV = [
    ...allChallenges.filter((c) => c.status === "live"),
    ...allChallenges.filter((c) => c.status === "upcoming"),
  ].slice(0, 5);

  // Ambiance: dominant emoji from live match reactions
  let ambiance: { emoji: string; label: string; color: string; sub: string } | null = null;
  try {
    const liveMatch = matches.find((m) => m.status === "live" || m.status === "halftime");
    if (liveMatch) {
      const { data: rxData } = await supabase
        .from("match_reactions")
        .select("emoji")
        .eq("match_id", liveMatch.id);

      const counts: Record<string, number> = {};
      for (const r of rxData ?? []) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
      const [topEmoji, topCount] = sorted[0] ?? [];
      if (topEmoji && topCount >= 3) {
        const state = AMBIANCE_STATES[topEmoji];
        if (state) ambiance = { emoji: topEmoji, ...state };
      }
    }
  } catch {}

  // Pre-match stats — always for the next upcoming match (any horizon)
  let prematch = null;
  try {
    const nextMatch = matches.find((m) => m.status === "upcoming");
    if (nextMatch) {
      prematch = await getPreMatchStats(supabase, nextMatch, leaderboard.length);
    }
  } catch {}

  // Goalscorer events for the results slide (finished / live / halftime matches)
  let matchEvents: Array<{ match_id: string; team_side: string; player_name: string | null; type: string; minute: number | null; extra_minute: number | null; detail: string | null }> = [];
  try {
    const scorableIds = matches
      .filter((m) => m.status === "finished" || m.status === "live" || m.status === "halftime")
      .map((m) => m.id);
    if (scorableIds.length > 0) {
      const { data: evts } = await supabase
        .from("match_events")
        .select("match_id, team_side, player_name, type, minute, extra_minute, detail")
        .in("match_id", scorableIds)
        .in("type", ["goal", "penalty"])
        .order("minute", { ascending: true });
      matchEvents = evts ?? [];
    }
  } catch {}

  // Meilleurs buteurs réels (tournoi entier) — affichés face aux buteurs pariés.
  const topScorers = await getTopScorers(supabase);

  return NextResponse.json({
    matches,
    leaderboard,
    individual,
    services,
    medals,
    brief,
    revivezPosts,
    challenges: challengesForTV,
    news,
    standings: standings ?? [],
    events: events ?? [],
    ambiance,
    prematch,
    todayStats,
    newPlayers,
    topScorerBets,
    topScorers,
    heatmap,
    hallofshame,
    visionnaire,
    matchEvents,
    drama,
    fantomes,
  });
}
