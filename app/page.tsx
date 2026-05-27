import Link from "next/link";
import { getMatches, getPredictionTrends } from "@/lib/data/matches";
import { getLeaderboard } from "@/lib/data/teams";
import { getTodayBrief, getRevivezPosts } from "@/lib/data/content";
import { MatchCard } from "@/components/matches/MatchCard";
import { TonightOnAir } from "@/components/matches/TonightOnAir";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { toNCDate, isToday } from "@/lib/utils";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MagicLinkReception } from "@/components/auth/MagicLinkReception";
import { PronoReminder } from "@/components/predictions/PronoReminder";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Non connecté → page de réception magic link
  if (!user) return <MagicLinkReception />;

  const [matches, trends, leaderboard, brief, revivez] = await Promise.all([
    getMatches(),
    getPredictionTrends(),
    getLeaderboard(),
    getTodayBrief(),
    getRevivezPosts(),
  ]);

  // Upcoming matches without user prediction
  const { data: profile } = await supabase.from("users").select("id").eq("auth_id", user.id).single();
  let missingPronoCount = 0;
  if (profile) {
    const now = new Date().toISOString();
    const upcoming = matches.filter((m) => m.status === "upcoming" && m.starts_at > now);
    if (upcoming.length > 0) {
      const { data: preds } = await supabase
        .from("predictions")
        .select("match_id")
        .eq("user_id", profile.id)
        .in("match_id", upcoming.map((m) => m.id));
      const predictedIds = new Set((preds ?? []).map((p) => p.match_id));
      missingPronoCount = upcoming.filter((m) => !predictedIds.has(m.id)).length;
    }
  }

  // Matchs LIVE — section dédiée en haut, masquée s'il n'y en a aucun.
  const liveMatches = matches.filter((m) => m.status === "live");
  // Matchs DU JOUR (heure NC) non-live — en CdM il y a ~1 match/jour, c'est le
  // repère utile. Affichés comme les autres (carte normale), "Terminé" inclus.
  const todayMatches = matches.filter((m) => isToday(m.starts_at) && m.status !== "live");
  // Fallback s'il n'y a aucun match aujourd'hui : le prochain match à venir.
  const nextMatch = matches.find((m) => m.status === "upcoming");
  const tonightMatches = matches.filter((m) => m.status === "upcoming").slice(0, 3);
  const topRevivez = revivez[0];

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <p className="text-xs text-canal-gray-muted uppercase tracking-widest mb-1">
          {toNCDate(new Date())} — Heure NC
        </p>
        <h1 className="canal-headline text-3xl">
          <span className="text-gradient-yellow">Canal Cup</span>{" "}
          <span className="text-white">2026</span>
        </h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Pronostics • Équipes • Babyfoot • Bonne ambiance
        </p>
      </div>

      {missingPronoCount > 0 && <PronoReminder count={missingPronoCount} />}

      {/* ─── EN DIRECT — section dédiée en haut, masquée si rien ne joue ─── */}
      {liveMatches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
              <span className="live-dot" /> En direct
            </h2>
            <Link href="/matches" className="text-xs text-canal-gray-muted hover:text-white">
              Tous les matchs →
            </Link>
          </div>
          <div className="space-y-3">
            {liveMatches.map((m) => (
              <MatchCard key={m.id} match={m} trend={trends[m.id]} />
            ))}
          </div>
        </section>
      )}

      {todayMatches.length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">
              ⚽ {todayMatches.length > 1 ? "Matchs du jour" : "Match du jour"}
            </h2>
            <Link href="/matches" className="text-xs text-canal-gray-muted hover:text-white">
              Tous les matchs →
            </Link>
          </div>
          <div className="space-y-4">
            {todayMatches.map((m) => (
              <MatchCard key={m.id} match={m} trend={trends[m.id]} />
            ))}
          </div>
        </section>
      ) : (
        nextMatch && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">
                ⚽ Prochain match
              </h2>
              <Link href="/matches" className="text-xs text-canal-gray-muted hover:text-white">
                Tous les matchs →
              </Link>
            </div>
            <MatchCard match={nextMatch} trend={trends[nextMatch.id]} />
          </section>
        )
      )}

      {tonightMatches.length > 0 && (
        <TonightOnAir matches={tonightMatches} title="À l'affiche — Canal+ / beIN Sports" />
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">
            📰 Matinale du jour
          </h2>
          <Link href="/matinale" className="text-xs text-canal-gray-muted hover:text-white">
            Lire →
          </Link>
        </div>
        <div className="canal-card">
          <p className="font-bold text-white mb-1">{brief.title}</p>
          <p className="text-canal-gray-muted text-sm leading-relaxed line-clamp-3">{brief.body}</p>
          <Link href="/matinale" className="inline-block mt-2 text-canal-yellow text-xs font-bold hover:underline">
            Lire la matinale complète →
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">
            🏆 Classement
          </h2>
          <Link href="/leaderboard" className="text-xs text-canal-gray-muted hover:text-white">
            Détail →
          </Link>
        </div>
        <LeaderboardTable rows={leaderboard} compact />
      </section>

      {topRevivez && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">
              💬 Revivez
            </h2>
            <Link href="/revivez" className="text-xs text-canal-gray-muted hover:text-white">
              Tout voir →
            </Link>
          </div>
          <div className="canal-card">
            <p className="text-xs text-canal-gray-muted mb-1">{topRevivez.team?.name ?? "Anonyme"}</p>
            <p className="font-bold text-white mb-1">{topRevivez.title}</p>
            <p className="text-canal-gray-muted text-sm italic line-clamp-2">{topRevivez.content}</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-canal-gray-muted">
              <Heart size={12} className="text-red-400" />
              <span>{topRevivez.votes_count} votes</span>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
