"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Clock, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { toNCDate, toNCTime } from "@/lib/utils";
import { ViewSwitcher } from "@/components/views/ViewSwitcher";
import { BracketBabyFoot } from "@/components/bracket/BracketBabyFoot";
import type { BabyFootMatch, Team } from "@/lib/supabase/types";

const STORAGE_KEY = "babyfoot-view";

// ─── Standard view components ────────────────────────────────────────────────

function BabyFootMatchCard({ match }: { match: BabyFootMatch }) {
  const isFinished = match.status === "finished";
  const isUpcoming = match.status === "upcoming";
  return (
    <div className="canal-card">
      <div className="flex items-center gap-1 text-xs text-canal-gray-muted mb-3">
        <Clock size={12} />
        <span>{toNCDate(match.starts_at)} — {toNCTime(match.starts_at)}</span>
        {match.status === "live" && (
          <span className="flex items-center gap-1 text-red-400 font-bold ml-2">
            <span className="live-dot" /> LIVE
          </span>
        )}
        {isFinished && <span className="ml-2">Terminé</span>}
        {isUpcoming && <span className="ml-2 text-canal-yellow">À venir</span>}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-canal-gray-mid flex items-center justify-center mb-1">
            <span className="font-black text-canal-yellow text-xl">{match.team_a?.name[0]}</span>
          </div>
          <span className="text-sm font-bold text-center leading-tight">{match.team_a?.name}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          {isFinished ? (
            <div className="flex gap-2 items-center">
              <span className="score-display text-3xl">{match.score_a}</span>
              <span className="text-canal-gray-muted">-</span>
              <span className="score-display text-3xl">{match.score_b}</span>
            </div>
          ) : (
            <Swords size={24} className="text-canal-yellow" />
          )}
          <span className="text-xs text-canal-gray-muted">Babyfoot</span>
        </div>
        <div className="flex-1 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-canal-gray-mid flex items-center justify-center mb-1">
            <span className="font-black text-canal-yellow text-xl">{match.team_b?.name[0]}</span>
          </div>
          <span className="text-sm font-bold text-center leading-tight">{match.team_b?.name}</span>
        </div>
      </div>
      {match.highlight && (
        <p className="mt-3 text-xs text-canal-gray-muted italic border-t border-canal-gray-light pt-2">
          💬 {match.highlight}
        </p>
      )}
    </div>
  );
}

function BabyFootLeaderboard({ matches, teams }: { matches: BabyFootMatch[]; teams: Team[] }) {
  const stats = teams
    .map((team) => {
      const played = matches.filter(
        (m) => m.status === "finished" && (m.team_a_id === team.id || m.team_b_id === team.id)
      );
      const won = played.filter((m) => {
        if (m.team_a_id === team.id) return (m.score_a ?? 0) > (m.score_b ?? 0);
        return (m.score_b ?? 0) > (m.score_a ?? 0);
      });
      return { team, played: played.length, won: won.length, points: won.length * 3 };
    })
    .filter((s) => s.played > 0)
    .sort((a, b) => b.points - a.points);

  if (!stats.length) return null;

  return (
    <div className="space-y-2">
      {stats.map((s, i) => (
        <div key={s.team.id} className="canal-card flex items-center gap-3">
          <span className="font-black text-canal-yellow w-6 text-center">
            {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
          </span>
          <div className="flex-1">
            <p className="font-bold text-white text-sm">{s.team.name}</p>
            <p className="text-xs text-canal-gray-muted">
              {s.played} joués · {s.won} victoire{s.won > 1 ? "s" : ""}
            </p>
          </div>
          <span className="font-black text-canal-yellow">{s.points} pts</span>
        </div>
      ))}
    </div>
  );
}

function StandardView({ matches, teams }: { matches: BabyFootMatch[]; teams: Team[] }) {
  const upcoming = matches.filter((m) => m.status === "upcoming");
  const live = matches.filter((m) => m.status === "live");
  const finished = matches.filter((m) => m.status === "finished");

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-3 flex items-center gap-2">
          <Trophy size={14} /> Classement babyfoot
        </h2>
        <BabyFootLeaderboard matches={matches} teams={teams} />
      </section>

      {live.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3">
            🔴 En cours
          </h2>
          <div className="space-y-3">
            {live.map((m) => <BabyFootMatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-3">
            ⏰ Prochains matchs
          </h2>
          <div className="space-y-3">
            {upcoming.map((m) => <BabyFootMatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-canal-gray-muted uppercase tracking-wider mb-3">
            Résultats
          </h2>
          <div className="space-y-3">
            {finished.map((m) => <BabyFootMatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BabyFootPage() {
  const [view, setView] = useState("standard");
  const [matches, setMatches] = useState<BabyFootMatch[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setView(stored);
  }, []);

  const changeView = useCallback((v: string) => {
    setView(v);
    localStorage.setItem(STORAGE_KEY, v);
  }, []);

  useEffect(() => {
    Promise.all([fetch("/api/babyfoot"), fetch("/api/teams")])
      .then(async ([mRes, tRes]) => {
        if (mRes.ok) setMatches(await mRes.json());
        if (tRes.ok) {
          const d = await tRes.json();
          setTeams(d.teams ?? d);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const finished = matches.filter((m) => m.status === "finished");

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="canal-headline text-2xl">Tournoi Babyfoot</h1>
          <p className="text-canal-gray-muted text-sm mt-1">
            {matches.length > 0
              ? `${matches.length} match${matches.length > 1 ? "s" : ""} · ${finished.length} terminé${finished.length > 1 ? "s" : ""}`
              : "Le football parallèle. Moins de VAR, plus de chaos."}
          </p>
        </div>
        <ViewSwitcher view={view} onChange={changeView} modes={["standard", "bracket"]} />
      </div>

      {loading ? (
        <p className="text-canal-gray-muted text-sm text-center py-12">Chargement…</p>
      ) : matches.length === 0 ? (
        <p className="text-canal-gray-muted text-sm text-center py-12">
          Aucun match pour l&apos;instant. Le tournoi n&apos;a pas encore démarré.
        </p>
      ) : view === "bracket" ? (
        <BracketBabyFoot matches={matches} />
      ) : (
        <StandardView matches={matches} teams={teams} />
      )}
    </div>
  );
}
