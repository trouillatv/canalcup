import Link from "next/link";
import { redirect } from "next/navigation";
import { getMatches, getPredictionTrends } from "@/lib/data/matches";
import { getLeaderboard } from "@/lib/data/teams";
import { getTodayBrief, getRevivezPosts } from "@/lib/data/content";
import { MatchCard } from "@/components/matches/MatchCard";
import { TonightOnAir } from "@/components/matches/TonightOnAir";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { toNCDate, isToday, tzLabel, normalizeTimezone } from "@/lib/utils";
import { Heart, ArrowRight } from "lucide-react";
import { getBabyfootRegistrationSnapshot } from "@/lib/data/babyfoot";
import { createClient } from "@/lib/supabase/server";
import { MagicLinkReception } from "@/components/auth/MagicLinkReception";
import { PronoReminder } from "@/components/predictions/PronoReminder";
import { ensureAllowlisted } from "@/lib/auth/allowlist";
import { isLastVoteDay } from "@/lib/supporters/access";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Non connecté → page de réception magic link
  if (!user) return <MagicLinkReception />;

  const allow = await ensureAllowlisted(user.email ?? "");
  if (!allow.ok) {
    await supabase.auth.signOut();
    return <MagicLinkReception />;
  }

  // Dernier jour de vote (25/06 NC) : l'accueil devient la page Journée Supporters.
  if (isLastVoteDay()) redirect("/supporters");

  const [matches, trends, leaderboard, brief, revivez, bfReg] = await Promise.all([
    getMatches(),
    getPredictionTrends(),
    getLeaderboard(),
    getTodayBrief(),
    getRevivezPosts(),
    getBabyfootRegistrationSnapshot(),
  ]);

  // Pronos de l'utilisateur (pour pré-remplir/afficher dans chaque MatchCard)
  // + compte des matchs à venir sans prono (bandeau de rappel).
  const { data: profile } = await supabase.from("users").select("id, timezone").eq("auth_id", user.id).single();
  const tz = normalizeTimezone(profile?.timezone);
  let missingPronoCount = 0;
  const savedPredictions: Record<string, { score_a: number; score_b: number; points?: number }> = {};
  if (profile) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("match_id, predicted_score_a, predicted_score_b, points_awarded")
      .eq("user_id", profile.id);
    for (const p of preds ?? []) {
      savedPredictions[p.match_id] = {
        score_a: p.predicted_score_a,
        score_b: p.predicted_score_b,
        points: p.points_awarded ?? undefined,
      };
    }
    const now = new Date().toISOString();
    const upcoming = matches.filter((m) => m.status === "upcoming" && m.starts_at > now);
    missingPronoCount = upcoming.filter((m) => !savedPredictions[m.id]).length;
  }

  // Matchs LIVE — section dédiée en haut, masquée s'il n'y en a aucun.
  const liveMatches = matches.filter((m) => m.status === "live");
  // Matchs DU JOUR (heure NC) non-live — en CdM il y a ~1 match/jour, c'est le
  // repère utile. Affichés comme les autres (carte normale), "Terminé" inclus.
  const todayMatches = matches.filter((m) => isToday(m.starts_at, tz) && m.status !== "live");
  // Fallback s'il n'y a aucun match aujourd'hui : le prochain match à venir.
  const nextMatch = matches.find((m) => m.status === "upcoming");
  const tonightMatches = matches.filter((m) => m.status === "upcoming").slice(0, 3);
  const topRevivez = revivez[0];

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <p className="text-xs text-canal-gray-muted uppercase tracking-widest mb-1">
          {toNCDate(new Date(), tz)} — Heure {tzLabel(tz)}
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

      {/* 🏓 Urgence inscriptions baby-foot (visible tant que c'est ouvert) */}
      {bfReg && (
        <Link href="/babyfoot/register" className="block canal-card border border-canal-yellow/50 bg-canal-yellow/10 hover:bg-canal-yellow/15 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0">🏓</span>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm">
                {bfReg.count} binôme{bfReg.count > 1 ? "s" : ""} inscrit{bfReg.count > 1 ? "s" : ""} au Tournoi Baby-foot
              </p>
              <p className="text-xs text-canal-yellow font-bold mt-0.5">
                {bfReg.remaining > 0 ? `Plus que ${bfReg.remaining} place${bfReg.remaining > 1 ? "s" : ""} · ` : ""}{bfReg.deadlineLabel}
              </p>
            </div>
            <ArrowRight className="text-canal-yellow shrink-0" size={18} />
          </div>
        </Link>
      )}

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
              <MatchCard key={m.id} match={m} trend={trends[m.id]} savedPrediction={savedPredictions[m.id]} />
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
              <MatchCard key={m.id} match={m} trend={trends[m.id]} savedPrediction={savedPredictions[m.id]} />
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
            <MatchCard match={nextMatch} trend={trends[nextMatch.id]} savedPrediction={savedPredictions[nextMatch.id]} />
          </section>
        )
      )}

      {tonightMatches.length > 0 && (
        <TonightOnAir matches={tonightMatches} title="À l'affiche — Canal+ / beIN Sports" />
      )}

      {brief && (
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
      )}

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
