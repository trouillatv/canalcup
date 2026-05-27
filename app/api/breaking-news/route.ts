// GET /api/breaking-news — auto-generated from recent events + live matches
// Returns last 5 news items sorted by recency

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshLiveMatches } from "@/services/football/sync";

const EVENT_LABELS: Record<string, string> = {
  goal: "⚽ But",
  yellow_card: "🟨 Carton jaune",
  red_card: "🟥 Carton rouge",
  substitution: "🔄 Remplacement",
  var: "📺 VAR",
  penalty: "🎯 Penalty",
  penalty_missed: "❌ Penalty raté",
};

// Fenêtre de récence du flash : un match (live OU terminé) n'apparaît au flash
// que si son coup d'envoi est dans les 5 dernières heures. C'est la MÊME fenêtre
// que le resync on-read (POST_MATCH_WINDOW côté sync) : le flash suit ainsi le
// statut réel affiché par le centre du match (live → "Live", finished →
// "Terminé"), sans JAMAIS forcer ni inventer un statut. On ne touche pas à la
// base : si le provider ne renvoie pas "finished" (ex. quota API épuisé), le
// statut reste tel quel et le flash le reflète honnêtement.
const RECENT_MATCH_MS = 5 * 60 * 60_000;

export async function GET() {
  const supabase = createAdminClient();

  // Le flash suit le direct : on rafraîchit d'abord les lignes des matchs en
  // fenêtre live (throttlé par le budget adaptatif), pour que le score/minute
  // affichés soient à jour même si personne n'est sur la fiche du match.
  await refreshLiveMatches().catch(() => {});

  const recentKickoff = new Date(Date.now() - RECENT_MATCH_MS).toISOString();

  // Live matches first — bornés à la fenêtre de récence (cohérent avec le centre).
  const { data: liveMatches } = await supabase
    .from("matches")
    .select("id, team_a, team_b, flag_a, flag_b, score_a, score_b, status, minute")
    .in("status", ["live", "halftime"])
    .gte("starts_at", recentKickoff);

  // Recent events (last 90 minutes)
  const since = new Date(Date.now() - 90 * 60_000).toISOString();
  const { data: events } = await supabase
    .from("match_events")
    .select("match_id, type, player_name, team_side, minute, detail, created_at")
    .gte("created_at", since)
    .order("minute", { ascending: false })
    .limit(10);

  // Matches for event context
  const matchIds = [...new Set((events ?? []).map((e) => e.match_id))];
  const { data: eventMatches } = matchIds.length
    ? await supabase.from("matches").select("id, team_a, team_b, flag_a, flag_b, score_a, score_b").in("id", matchIds)
    : { data: [] };

  const matchById = Object.fromEntries((eventMatches ?? []).map((m) => [m.id, m]));

  const news: { text: string; sub?: string; type: string; at: string }[] = [];

  // Live match news — flag_a/flag_b peuvent être soit un emoji unicode
  // (vraies équipes WC, ex. '🇫🇷'), soit une URL (https://media.api-sports.io/…).
  // Si URL, on ne l'inclut PAS dans le texte (sinon l'URL apparaît en clair).
  const flagText = (f: string | null | undefined) =>
    f && !f.startsWith("http") ? `${f} ` : "";

  for (const m of liveMatches ?? []) {
    if (m.status === "halftime") {
      news.push({
        type: "live",
        text: `Mi-temps · ${flagText(m.flag_a)}${m.team_a} ${m.score_a ?? 0}–${m.score_b ?? 0} ${flagText(m.flag_b)}${m.team_b}`,
        at: new Date().toISOString(),
      });
    } else {
      news.push({
        type: "live",
        text: `${m.minute ? `${m.minute}'` : "Direct"} · ${flagText(m.flag_a)}${m.team_a} ${m.score_a ?? 0}–${m.score_b ?? 0} ${flagText(m.flag_b)}${m.team_b}`,
        at: new Date().toISOString(),
      });
    }
  }

  // Event news
  for (const e of events ?? []) {
    const m = matchById[e.match_id];
    if (!m) continue;
    const teamName = e.team_side === "home" ? m.team_a : m.team_b;
    const label = EVENT_LABELS[e.type] ?? "📢";
    const score = m.score_a !== null ? `(${m.score_a}–${m.score_b})` : "";
    news.push({
      type: e.type,
      text: `${label} — ${e.player_name} (${teamName}) ${e.minute}'`,
      sub: `${m.team_a} vs ${m.team_b} ${score}`,
      at: e.created_at,
    });
  }

  // Matchs RÉCEMMENT terminés : on annonce le résultat final tant que le coup
  // d'envoi est dans la fenêtre de récence (5 h, même borne que le live). Le
  // flash affiche "Terminé" aussi longtemps que le centre du match l'affiche
  // pour un match récent ; au-delà de 5 h le flash s'efface tout seul.
  const { data: justFinished } = await supabase
    .from("matches")
    .select("team_a, team_b, flag_a, flag_b, score_a, score_b, starts_at, updated_at")
    .eq("status", "finished")
    .gte("starts_at", recentKickoff)
    .order("updated_at", { ascending: false })
    .limit(3);

  for (const m of justFinished ?? []) {
    news.push({
      type: "finished",
      text: `⏹️ Terminé · ${flagText(m.flag_a)}${m.team_a} ${m.score_a ?? 0}–${m.score_b ?? 0} ${flagText(m.flag_b)}${m.team_b}`,
      at: m.updated_at ?? m.starts_at,
    });
  }

  // Upcoming matches in next 30 min
  const soon = new Date(Date.now() + 30 * 60_000).toISOString();
  const { data: upcoming } = await supabase
    .from("matches")
    .select("team_a, team_b, flag_a, flag_b, starts_at")
    .eq("status", "upcoming")
    .lte("starts_at", soon)
    .order("starts_at", { ascending: true })
    .limit(2);

  for (const m of upcoming ?? []) {
    const t = new Date(m.starts_at).toLocaleTimeString("fr-NC", {
      hour: "2-digit", minute: "2-digit", timeZone: "Pacific/Noumea",
    });
    news.push({
      type: "upcoming",
      text: `⏱️ Coup d'envoi dans moins de 30min`,
      sub: `${m.flag_a ?? ""} ${m.team_a} vs ${m.team_b} ${m.flag_b ?? ""} — ${t} NC`,
      at: m.starts_at,
    });
  }

  // Sort by date desc, take top 5
  news.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return NextResponse.json(
    { news: news.slice(0, 5) },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=10" } }
  );
}
