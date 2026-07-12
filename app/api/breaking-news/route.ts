// GET /api/breaking-news — auto-generated from recent events + live matches
// Returns last 5 news items sorted by recency

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshLiveMatches, syncFixturesThrottled } from "@/services/football/sync";

// Un vrai match n'est plus jamais "live" au-delà de ~3h30 après le coup d'envoi
// (90' + mi-temps + prolongations + t.a.b. + arrêts de jeu). Garde-fou d'affichage
// (jamais une mutation de statut) contre un match resté coincé en "live" en base.
const LIVE_WINDOW_MS = 210 * 60_000;
// "Terminé · score" n'est annoncé que ~30 min après le coup de sifflet réel
// (finished_at), puis le flash se masque tout seul.
const TERMINE_FLASH_MS = 30 * 60_000;

export async function GET() {
  const supabase = createAdminClient();

  // Le flash suit le direct : on rafraîchit d'abord les lignes des matchs en
  // fenêtre live (throttlé par le budget adaptatif), pour que le score/minute
  // affichés soient à jour même si personne n'est sur la fiche du match.
  await refreshLiveMatches().catch(() => {});

  // Insère les nouveaux tours à élimination directe (ex. un quart de finale qui
  // vient d'être fixé chez le fournisseur) SANS attendre le cron quotidien —
  // sinon le match reste invisible et impariable jusqu'à 24 h. Throttlé en base
  // (≤ 1×/20 min), et jamais bloquant pour le flash.
  await syncFixturesThrottled().catch(() => {});

  // Live matches first — bornés pour ne pas afficher un match coincé en "live".
  const liveFloor = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
  const { data: liveMatches } = await supabase
    .from("matches")
    .select("id, team_a, team_b, flag_a, flag_b, score_a, score_b, status, minute")
    .in("status", ["live", "halftime"])
    .gte("starts_at", liveFloor);

  // Événements du flash : UNIQUEMENT les buts (pas les cartons/remplacements),
  // et UNIQUEMENT pour les matchs encore en cours. Dès qu'un match est terminé,
  // il sort de liveMatches → ses buts disparaissent du flash (annonce "Terminé"
  // prend le relais). On filtre donc sur les ids live, pas sur le statut global.
  const liveById = Object.fromEntries((liveMatches ?? []).map((m) => [m.id, m]));
  const liveIds = Object.keys(liveById);
  const since = new Date(Date.now() - 90 * 60_000).toISOString();
  const { data: events } = liveIds.length
    ? await supabase
        .from("match_events")
        .select("match_id, type, player_name, team_side, minute, created_at")
        .in("match_id", liveIds)
        .in("type", ["goal", "penalty"])
        .gte("created_at", since)
        .order("minute", { ascending: false })
        .limit(10)
    : { data: [] };

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

  // Buts (matchs en cours uniquement) — "⚽ But — Joueur (Équipe) 51'".
  for (const e of events ?? []) {
    const m = liveById[e.match_id];
    if (!m) continue;
    const teamName = e.team_side === "home" ? m.team_a : m.team_b;
    const score = m.score_a !== null ? `(${m.score_a}–${m.score_b})` : "";
    news.push({
      type: "goal",
      text: `⚽ But — ${e.player_name} (${teamName}) ${e.minute}'`,
      sub: `${m.team_a} vs ${m.team_b} ${score}`,
      at: e.created_at,
    });
  }

  // Matchs RÉCEMMENT terminés : on annonce le résultat final ~30 min après le
  // coup de sifflet RÉEL (finished_at, stampé par le resync), puis le flash se
  // masque tout seul. .gte("finished_at", …) exclut nativement les lignes à
  // finished_at nul (matchs importés déjà terminés) : pas de "Terminé" à tort.
  const termineFloor = new Date(Date.now() - TERMINE_FLASH_MS).toISOString();
  const { data: justFinished } = await supabase
    .from("matches")
    .select("team_a, team_b, flag_a, flag_b, score_a, score_b, finished_at")
    .eq("status", "finished")
    .gte("finished_at", termineFloor)
    .order("finished_at", { ascending: false })
    .limit(3);

  for (const m of justFinished ?? []) {
    news.push({
      type: "finished",
      text: `⏹️ Terminé · ${flagText(m.flag_a)}${m.team_a} ${m.score_a ?? 0}–${m.score_b ?? 0} ${flagText(m.flag_b)}${m.team_b}`,
      at: m.finished_at,
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
