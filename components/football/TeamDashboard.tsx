"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/shared/Flag";
import { LocalTime } from "@/components/timezone/LocalTime";
import { formCode } from "@/lib/football/wc-teams";
import { wcTeamHref } from "@/lib/football/wc-teams-index";
import type { FootballTeamDashboard, WCMatchSummary, FootballGroupRow } from "@/lib/data/football-team";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RESULT_STYLE: Record<string, string> = {
  W: "bg-green-500/20 text-green-400 border border-green-500/40",
  D: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  L: "bg-red-500/20 text-red-400 border border-red-500/40",
};
const RESULT_LABEL: Record<string, string> = { W: "V", D: "N", L: "D" };

const FORM_STYLE: Record<string, string> = {
  V: "bg-green-500/20 text-green-400 border border-green-500/40",
  N: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  D: "bg-red-500/20 text-red-400 border border-red-500/40",
  "?": "bg-canal-gray-mid text-canal-gray-muted border-canal-gray-light",
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-black text-canal-yellow uppercase tracking-widest mb-2">
      {children}
    </h2>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="canal-card text-center py-3 px-2">
      <p className="text-canal-gray-muted text-[10px] uppercase tracking-wider leading-tight">{label}</p>
      <p className={cn("font-black text-xl mt-1", accent ? "text-canal-yellow" : "text-white")}>
        {value}
      </p>
    </div>
  );
}

function GroupTable({
  rows,
  highlightName,
}: {
  rows: FootballGroupRow[];
  highlightName: string;
}) {
  function isMe(name: string) {
    return name.toLowerCase() === highlightName.toLowerCase();
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-canal-gray-muted border-b border-canal-gray-light">
            <th className="text-left pb-1.5 w-5 font-medium">#</th>
            <th className="text-left pb-1.5 font-medium">Équipe</th>
            <th className="text-center pb-1.5 w-6 font-medium">J</th>
            <th className="text-center pb-1.5 w-6 font-medium">G</th>
            <th className="text-center pb-1.5 w-6 font-medium">N</th>
            <th className="text-center pb-1.5 w-6 font-medium">P</th>
            <th className="text-center pb-1.5 w-10 font-medium">Buts</th>
            <th className="text-center pb-1.5 w-8 font-medium">+/-</th>
            <th className="text-center pb-1.5 w-7 font-black text-canal-yellow">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const me = isMe(row.team_name_fr);
            const href = wcTeamHref(row.team_name_fr);
            const nameEl = (
              <span className="flex items-center gap-1.5 min-w-0">
                <Flag flag={row.team_flag || null} name={row.team_name_fr} className="h-3.5 w-auto rounded-sm shrink-0" emojiClassName="text-sm shrink-0" />
                <span className={cn("truncate", me ? "font-black text-white" : i < 2 ? "font-semibold text-white" : "text-canal-gray-muted")}>
                  {row.team_name_fr}
                </span>
              </span>
            );
            return (
              <tr
                key={row.team_name_fr}
                className={cn(
                  "border-b border-canal-gray-light/20",
                  me && "bg-canal-yellow/5 rounded"
                )}
              >
                <td className={cn("py-1.5 text-center font-bold", me ? "text-canal-yellow" : i < 2 ? "text-white" : "text-canal-gray-muted")}>
                  {i + 1}
                </td>
                <td className="py-1.5 min-w-0">
                  {href && !me ? (
                    <Link href={href} className="hover:text-canal-yellow transition-colors" onClick={(e) => e.stopPropagation()}>
                      {nameEl}
                    </Link>
                  ) : nameEl}
                </td>
                <td className={cn("py-1.5 text-center", me ? "text-white" : "text-canal-gray-muted")}>{row.played}</td>
                <td className={cn("py-1.5 text-center", me ? "text-white" : "text-canal-gray-muted")}>{row.won}</td>
                <td className={cn("py-1.5 text-center", me ? "text-white" : "text-canal-gray-muted")}>{row.draw}</td>
                <td className={cn("py-1.5 text-center", me ? "text-white" : "text-canal-gray-muted")}>{row.lost}</td>
                <td className={cn("py-1.5 text-center", me ? "text-white" : "text-canal-gray-muted")}>
                  {row.goals_for}:{row.goals_against}
                </td>
                <td className={cn("py-1.5 text-center", me ? "text-white" : "text-canal-gray-muted")}>
                  {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                </td>
                <td className={cn("py-1.5 text-center font-black", me ? "text-canal-yellow text-sm" : i < 2 ? "text-canal-yellow" : "text-canal-gray-muted")}>
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MatchResultRow({ match }: { match: WCMatchSummary }) {
  const oppName = match.isHome ? match.teamAway : match.teamHome;
  const oppFlag = match.isHome ? match.flagAway : match.flagHome;
  const myScore = match.isHome ? match.scoreHome : match.scoreAway;
  const oppScore = match.isHome ? match.scoreAway : match.scoreHome;

  return (
    <Link href={`/matches/${match.id}`} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0 hover:bg-canal-gray/30 rounded-lg px-2 -mx-2 transition-colors">
      <Flag flag={oppFlag} name={oppName} className="h-5 w-auto rounded-sm shrink-0" emojiClassName="text-lg shrink-0" />
      <span className="flex-1 text-sm text-white font-semibold truncate">{oppName}</span>
      <span className="font-black text-sm text-canal-yellow tabular-nums shrink-0">
        {myScore ?? "—"} – {oppScore ?? "—"}
      </span>
      {match.result && (
        <span className={cn("text-[11px] font-black px-2 py-0.5 rounded border shrink-0", RESULT_STYLE[match.result])}>
          {RESULT_LABEL[match.result]}
        </span>
      )}
    </Link>
  );
}

function UpcomingMatchRow({ match }: { match: WCMatchSummary }) {
  const oppName = match.isHome ? match.teamAway : match.teamHome;
  const oppFlag = match.isHome ? match.flagAway : match.flagHome;
  const isLive = match.status === "live" || match.status === "halftime";

  return (
    <div className="canal-card p-3">
      <div className="flex items-center gap-3">
        <Flag flag={oppFlag} name={oppName} className="h-6 w-auto rounded-sm shrink-0" emojiClassName="text-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">
            {match.isHome ? "vs" : "vs"} {oppName}
          </p>
          <p className="text-xs text-canal-gray-muted mt-0.5 flex items-center gap-1.5">
            {isLive ? (
              <span className="text-red-400 font-bold animate-pulse">🔴 En direct</span>
            ) : (
              <>
                <LocalTime date={match.startsAt} variant="date" />
                <span>·</span>
                <LocalTime date={match.startsAt} variant="time" withLabel />
                {match.channel && <><span>·</span><span>{match.channel}</span></>}
              </>
            )}
          </p>
        </div>
        <Link
          href={`/matches/${match.id}`}
          className="shrink-0 text-xs font-black bg-canal-yellow/15 hover:bg-canal-yellow/25 text-canal-yellow px-2.5 py-1.5 rounded-lg transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {isLive ? "Suivre" : "Pronostiquer"}
        </Link>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function TeamDashboard({ data }: { data: FootballTeamDashboard }) {
  const router = useRouter();
  const { wcTeam, groupLetter, fifaRank, confederation, groupStandings, pastMatches, upcomingMatches, wcStats } = data;

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/bracket");
  };

  const formBadges = wcTeam.form.slice(0, 5);

  // Joueur le plus valorisé (valeur numérique max parmi les joueurs)
  const topPlayer = wcTeam.players
    .filter((p) => p.value)
    .map((p) => ({
      name: p.name,
      raw: parseFloat((p.value ?? "").replace(/[^0-9.,]/g, "").replace(",", ".")),
      label: p.value!,
      unit: (p.value ?? "").includes("M") ? "M" : (p.value ?? "").includes("k") ? "k" : "",
    }))
    .filter((p) => !isNaN(p.raw) && p.raw > 0)
    .sort((a, b) => {
      const av = a.unit === "M" ? a.raw * 1_000_000 : a.unit === "k" ? a.raw * 1_000 : a.raw;
      const bv = b.unit === "M" ? b.raw * 1_000_000 : b.unit === "k" ? b.raw * 1_000 : b.raw;
      return bv - av;
    })[0] ?? null;

  return (
    <div className="px-4 py-4 space-y-5 max-w-2xl mx-auto pb-24">

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          aria-label="Retour"
          className="flex items-center gap-1 text-canal-gray-muted hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Retour</span>
        </button>
        <span className="text-canal-gray-muted text-sm">Sélections · CdM 2026</span>
      </div>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="canal-card border border-canal-yellow/20 space-y-3">
        <div className="flex items-center gap-4">
          <Flag
            flag={null}
            name={wcTeam.name}
            className="h-12 w-auto rounded-sm shrink-0 shadow"
            emojiClassName="text-5xl leading-none shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="canal-headline text-xl truncate">{wcTeam.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              {fifaRank && (
                <span className="text-canal-yellow text-xs font-black">
                  FIFA #{fifaRank}
                </span>
              )}
              {confederation && (
                <span className="text-canal-gray-muted text-xs font-medium">{confederation}</span>
              )}
              {groupLetter && (
                <Link
                  href={`/bracket?group=${groupLetter}`}
                  className="text-canal-gray-muted text-xs hover:text-canal-yellow transition-colors"
                >
                  Groupe {groupLetter} →
                </Link>
              )}
              {wcTeam.squadValue && (
                <span className="text-canal-gray-muted text-xs">
                  Effectif&nbsp;: <span className="text-white font-bold">{wcTeam.squadValue}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Lien vers l'effectif complet */}
        <Link
          href={`/wc-team/${wcTeam.slug}`}
          className="flex items-center gap-2 text-xs text-canal-gray-muted hover:text-white transition-colors border-t border-canal-gray-light/20 pt-2.5"
        >
          <Users size={12} />
          <span>Voir l&apos;effectif complet</span>
          <span className="ml-auto text-canal-gray-muted/50">→</span>
        </Link>
      </div>

      {/* ── CLASSEMENT DU GROUPE ─────────────────────────────────────────── */}
      {groupStandings.length > 0 && (
        <section>
          <SectionTitle>
            {groupLetter ? `Classement — Groupe ${groupLetter}` : "Classement"}
          </SectionTitle>
          <div className="canal-card">
            <GroupTable rows={groupStandings} highlightName={wcTeam.name} />
          </div>
        </section>
      )}

      {/* ── RÉSULTATS DANS LA COMPÉTITION ────────────────────────────────── */}
      {pastMatches.length > 0 && (
        <section>
          <SectionTitle>Résultats Coupe du Monde</SectionTitle>
          <div className="canal-card divide-y divide-canal-gray-light/20">
            {pastMatches.map((m) => (
              <MatchResultRow key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {/* ── PROCHAINS MATCHS ─────────────────────────────────────────────── */}
      {upcomingMatches.length > 0 && (
        <section>
          <SectionTitle>
            {upcomingMatches.some((m) => m.status === "live" || m.status === "halftime")
              ? "En cours · Prochains matchs"
              : "Prochains matchs"}
          </SectionTitle>
          <div className="space-y-2">
            {upcomingMatches.map((m) => (
              <UpcomingMatchRow key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {/* ── STATS COUPE DU MONDE ─────────────────────────────────────────── */}
      <section>
        <SectionTitle>Stats Coupe du Monde</SectionTitle>
        {wcStats.played === 0 ? (
          <p className="canal-card text-center text-canal-gray-muted text-sm py-4">
            Stats disponibles dès le coup d&apos;envoi de la compétition.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            <StatCard label="Matchs" value={wcStats.played} />
            <StatCard label="Victoires" value={wcStats.won} accent />
            <StatCard label="Nuls" value={wcStats.draw} />
            <StatCard label="Défaites" value={wcStats.lost} />
            <StatCard label="Buts pour" value={wcStats.goalsFor} accent />
            <StatCard label="Buts conc." value={wcStats.goalsAgainst} />
            <StatCard
              label="+/-"
              value={wcStats.goalDiff > 0 ? `+${wcStats.goalDiff}` : wcStats.goalDiff}
              accent={wcStats.goalDiff > 0}
            />
            <StatCard label="Points" value={wcStats.points} accent />
          </div>
        )}
      </section>

      {/* ── VALEUR EFFECTIF ──────────────────────────────────────────────── */}
      {(wcTeam.squadValue || topPlayer) && (
        <section>
          <SectionTitle>Valeur de l&apos;effectif</SectionTitle>
          <div className={cn("grid gap-2", topPlayer ? "grid-cols-2" : "grid-cols-1")}>
            {wcTeam.squadValue && (
              <div className="canal-card text-center">
                <p className="text-canal-gray-muted text-xs">Valeur totale (est.)</p>
                <p className="text-canal-yellow font-black text-xl mt-1">{wcTeam.squadValue}</p>
              </div>
            )}
            {topPlayer && (
              <div className="canal-card text-center">
                <p className="text-canal-gray-muted text-xs">Joueur le + valorisé</p>
                <p className="text-white font-black text-sm mt-1 truncate">{topPlayer.name}</p>
                <p className="text-canal-yellow font-bold text-xs">{topPlayer.label}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── FORME ────────────────────────────────────────────────────────── */}
      {formBadges.length > 0 && (
        <section>
          <SectionTitle>Forme récente</SectionTitle>
          <div className="canal-card flex flex-wrap items-center gap-2">
            {formBadges.map((f, i) => {
              const c = formCode(f);
              return (
                <span
                  key={i}
                  className={cn(
                    "w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black shrink-0",
                    FORM_STYLE[c]
                  )}
                  title={f}
                >
                  {c}
                </span>
              );
            })}
            {formBadges.length > 0 && (
              <span className="text-canal-gray-muted text-xs ml-1 italic">5 derniers matchs</span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
