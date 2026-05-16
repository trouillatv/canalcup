import Link from "next/link";
import {
  MOCK_MATCHES, MOCK_MORNING_BRIEF, MOCK_LEADERBOARD,
  MOCK_REVIVEZ, MOCK_PREDICTION_TRENDS
} from "@/lib/mock-data";
import { MatchCard } from "@/components/matches/MatchCard";
import { MatchOfWeekHero } from "@/components/matches/MatchOfWeekHero";
import { TonightOnAir } from "@/components/matches/TonightOnAir";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { toNCDate, toNCTime, flagEmoji } from "@/lib/utils";
import { ChannelBadge } from "@/components/matches/ChannelBadge";
import { Calendar, Trophy, Users, Newspaper, Gamepad2, Heart } from "lucide-react";

export default function DashboardPage() {
  const matchOfWeek = MOCK_MATCHES.find((m) => m.is_match_of_week);
  const matchToday = MOCK_MATCHES.find((m) => m.status === "live")
    ?? MOCK_MATCHES.find((m) => m.status === "upcoming" && !m.is_match_of_week);
  const tonightMatches = MOCK_MATCHES.filter((m) => m.status === "upcoming").slice(0, 3);
  const brief = MOCK_MORNING_BRIEF;
  const topRevivez = MOCK_REVIVEZ[0];
  const trend = matchToday ? MOCK_PREDICTION_TRENDS[matchToday.id] : undefined;

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
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

      {/* Match de la semaine — Hero premium */}
      {matchOfWeek && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">
              ⭐ Match de la semaine
            </h2>
            <Link href="/matches" className="text-xs text-canal-gray-muted hover:text-white">
              Tous les matchs →
            </Link>
          </div>
          <MatchOfWeekHero
            match={matchOfWeek}
            tagline="Le match qui peut ruiner tous les pronostics du bureau."
          />
        </section>
      )}

      {/* Ce soir sur Canal+/beIN */}
      {tonightMatches.length > 0 && (
        <TonightOnAir matches={tonightMatches} title="À l'affiche — Canal+ / beIN Sports" />
      )}

      {/* Prochain match avec cotes */}
      {matchToday && !matchToday.is_match_of_week && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">
              {matchToday.status === "live" ? "🔴 En direct" : "⚽ Prochain match"}
            </h2>
          </div>
          <MatchCard match={matchToday} trend={trend} />
        </section>
      )}

      {/* Matinale du jour */}
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
          <p className="text-canal-gray-muted text-sm leading-relaxed line-clamp-3">
            {brief.body}
          </p>
          <Link
            href="/matinale"
            className="inline-block mt-2 text-canal-yellow text-xs font-bold hover:underline"
          >
            Lire la matinale complète →
          </Link>
        </div>
      </section>

      {/* Classement compact */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">
            🏆 Classement
          </h2>
          <Link href="/leaderboard" className="text-xs text-canal-gray-muted hover:text-white">
            Détail →
          </Link>
        </div>
        <LeaderboardTable rows={MOCK_LEADERBOARD} compact />
      </section>

      {/* Post du jour depuis Revivez */}
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

      {/* Raccourcis */}
      <section>
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-3">
          Navigation rapide
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/matches", icon: Calendar, label: "Matchs & Pronostics", sub: "Vote en 10s" },
            { href: "/leaderboard", icon: Trophy, label: "Classement complet", sub: "Points détaillés" },
            { href: "/teams", icon: Users, label: "Équipes", sub: "Fiches & stats" },
            { href: "/babyfoot", icon: Gamepad2, label: "Babyfoot", sub: "Tournoi interne" },
            { href: "/quiz-live", icon: Gamepad2, label: "Quiz Live", sub: "15 secondes !" },
            { href: "/revivez", icon: Newspaper, label: "Revivez", sub: "Fails & phrases cultes" },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link
              key={href}
              href={href}
              className="canal-card hover:bg-canal-gray-mid transition-colors flex flex-col gap-2"
            >
              <Icon size={20} className="text-canal-yellow" />
              <div>
                <p className="font-bold text-white text-sm leading-tight">{label}</p>
                <p className="text-canal-gray-muted text-xs">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
