"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { teamFlag, cn } from "@/lib/utils";
import { WC2026_GROUPS } from "@/lib/football/groups-2026";
import { TeamLink } from "@/components/teams/TeamLink";
import { LocalTime } from "@/components/timezone/LocalTime";

interface MatchRow {
  id: string;
  team_a: string;
  team_b: string;
  flag_a?: string;
  flag_b?: string;
  score_a?: number | null;
  score_b?: number | null;
  status: string;
  starts_at: string;
  phase?: string;
  stage?: string;
  channel?: string;
}

interface StandingRow {
  team_name_fr: string;
  team_flag: string;
  rank: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

interface GroupBucket { stage?: string; matches: MatchRow[] }
interface PhaseSection { phase: string; groups: GroupBucket[] }
export interface BracketData { phases: PhaseSection[]; standings: Record<string, StandingRow[]> }

const KNOCKOUT_ORDER = [
  "Trente-deuxièmes",
  "Seizièmes",
  "Huitièmes",
  "Quarts",
  "Demis",
  "Finale",
];

const PHASE_EMOJIS: Record<string, string> = {
  "Trente-deuxièmes": "🎯", Seizièmes: "🎲", Huitièmes: "🔥", Quarts: "⚡",
  Demis: "🌟", "3ème place": "🥉", Finale: "🏆",
};

const PHASE_LABELS: Record<string, string> = {
  "Trente-deuxièmes": "32es de finale",
  Seizièmes: "16es de finale",
  Huitièmes: "Huitièmes",
  Quarts: "Quarts de finale",
  Demis: "Demi-finales",
  "3ème place": "Petite finale",
  Finale: "Finale",
};

// ─── Knockout match card ─────────────────────────────────────────────────────

function BracketTeamLine({
  flag, name, score, isWinner, dim, live,
}: {
  flag: string; name: string; score?: number | null;
  isWinner: boolean; dim: boolean; live: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-2.5 py-1.5", dim && "opacity-40")}>
      <TeamLink
        name={name}
        flag={flag}
        flagClassName="text-xl"
        className={cn("text-sm font-bold", isWinner ? "text-canal-yellow" : "text-white")}
        wrapperClassName="flex-1 min-w-0"
      />
      <span
        className={cn(
          "shrink-0 w-6 text-center text-sm font-black tabular-nums",
          isWinner ? "text-canal-yellow" : live ? "text-red-400" : "text-canal-gray-muted"
        )}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

function BracketTreeCard({ match, big }: { match: MatchRow; big?: boolean }) {
  const isLive = match.status === "live" || match.status === "halftime";
  const isFinished = match.status === "finished";
  const isTbd = !match.team_a || match.team_a === "TBD";
  const hasScore = match.score_a !== null && match.score_a !== undefined;

  const winner =
    isFinished && hasScore && match.score_b !== null && match.score_b !== undefined
      ? match.score_a! > match.score_b! ? "a" : match.score_a! < match.score_b! ? "b" : null
      : null;

  const card = (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-all",
        big ? "w-64 shadow-[0_0_40px_rgba(255,215,0,0.18)]" : "w-52",
        isLive
          ? "border-red-500/60 bg-gradient-to-b from-red-950/40 to-canal-gray-mid/40"
          : isFinished
          ? "border-canal-yellow/40 bg-gradient-to-b from-canal-gray-mid to-canal-gray"
          : isTbd
          ? "border-canal-gray-light/20 bg-canal-gray/20"
          : "border-canal-gray-light/40 bg-canal-gray-mid/30 hover:border-canal-yellow/50"
      )}
    >
      <div className="flex items-center justify-between px-2.5 pt-1.5">
        <span className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">
          {isTbd ? "À venir" : isLive ? <span className="text-red-400 animate-pulse">● Live</span> : isFinished ? "Terminé" : <><LocalTime date={match.starts_at} variant="dateShort" /> <LocalTime date={match.starts_at} variant="time" /></>}
        </span>
      </div>
      <BracketTeamLine
        flag={teamFlag(match.flag_a, match.team_a)}
        name={isTbd ? "—" : match.team_a}
        score={match.score_a}
        isWinner={winner === "a"}
        dim={winner === "b"}
        live={isLive}
      />
      <div className="h-px bg-canal-gray-light/30 mx-2.5" />
      <BracketTeamLine
        flag={teamFlag(match.flag_b, match.team_b)}
        name={isTbd ? "—" : match.team_b}
        score={match.score_b}
        isWinner={winner === "b"}
        dim={winner === "a"}
        live={isLive}
      />
    </div>
  );

  if (isTbd) return card;
  return (
    <Link href={`/matches/${match.id}`} className="block">
      {card}
    </Link>
  );
}

// ─── Connector column ────────────────────────────────────────────────────────
// Equal-height columns + justify-around guarantee that each pair's vertical
// midpoint aligns exactly with the single match it feeds into the next round.

const HEADER_H = "h-12";

function ConnectorColumn({ nextCount }: { nextCount: number }) {
  return (
    <div className="flex flex-col w-8 sm:w-12 shrink-0">
      <div className={HEADER_H} />
      <div className="flex-1 flex flex-col justify-around">
        {Array.from({ length: nextCount }).map((_, j) => (
          <div key={j} className="flex-1 flex items-center">
            <div className="h-1/2 w-full border-r-2 border-t-2 border-b-2 border-canal-yellow/25 rounded-r-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Round column ────────────────────────────────────────────────────────────

function RoundColumn({
  phase, matches, isLast,
}: {
  phase: string; matches: MatchRow[]; isLast: boolean;
}) {
  const emoji = PHASE_EMOJIS[phase] ?? "⚽";
  const label = PHASE_LABELS[phase] ?? phase;
  const isFinale = phase === "Finale";

  return (
    <div className="flex flex-col shrink-0">
      <div className={cn(HEADER_H, "flex items-center justify-center px-3")}>
        <span
          className={cn(
            "font-black uppercase tracking-widest whitespace-nowrap",
            isFinale ? "text-canal-yellow text-base" : "text-canal-gray-muted text-xs"
          )}
        >
          {emoji} {label}
        </span>
      </div>
      <div className="flex-1 flex flex-col justify-around gap-3 px-1">
        {matches.map((m) => (
          <div key={m.id} className="relative flex items-center">
            <BracketTreeCard match={m} big={isFinale} />
            {!isLast && (
              <span className="absolute left-full top-1/2 -translate-y-1/2 h-px w-2 bg-canal-yellow/25" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Group phase — one tab per pool (A–L) ────────────────────────────────────

function groupLetter(raw: string): string {
  // "Group A" / "Groupe A" / "A" → "A" ; matchday numbers → ""
  const m = raw.match(/([a-l])\s*$/i);
  return m ? m[1].toUpperCase() : "";
}

// Une ligne de match de poule (vrais matchs sous le tableau).
function GroupMatchRow({ m }: { m: MatchRow }) {
  const live = m.status === "live" || m.status === "halftime";
  const finished = m.status === "finished";
  const hasScore = m.score_a !== null && m.score_a !== undefined && m.score_b !== null && m.score_b !== undefined;
  return (
    <div className="flex items-center gap-2 text-xs py-2 border-b border-canal-gray-light/15 last:border-0">
      <span className="w-16 shrink-0 text-[11px] text-canal-gray-muted text-center">
        {live ? (
          <span className="text-red-400 font-bold animate-pulse">● live</span>
        ) : finished ? (
          "Fini"
        ) : (
          <span className="flex flex-col items-center leading-tight">
            <LocalTime date={m.starts_at} variant="dateShort" />
            <LocalTime date={m.starts_at} variant="time" />
          </span>
        )}
      </span>
      <TeamLink
        name={m.team_a}
        flag={teamFlag(m.flag_a, m.team_a)}
        flagSide="right"
        flagClassName="text-sm"
        className="text-right font-semibold"
        wrapperClassName="flex-1 justify-end"
      />
      <span className="shrink-0 w-12 text-center font-black tabular-nums">
        {hasScore ? `${m.score_a}–${m.score_b}` : "—"}
      </span>
      <TeamLink
        name={m.team_b}
        flag={teamFlag(m.flag_b, m.team_b)}
        flagSide="left"
        flagClassName="text-sm"
        className="font-semibold"
        wrapperClassName="flex-1"
      />
    </div>
  );
}

function GroupTabs({
  standings,
  matchesByLetter,
  initialGroup,
}: {
  standings: Record<string, StandingRow[]>;
  matchesByLetter: Record<string, MatchRow[]>;
  initialGroup?: string | null;
}) {
  const [active, setActive] = useState(() => {
    const wanted = (initialGroup ?? "").toUpperCase();
    return WC2026_GROUPS.some((g) => g.letter === wanted)
      ? wanted
      : WC2026_GROUPS[0]?.letter ?? "A";
  });

  // Live standings (if the tournament has data) keyed by group letter
  const liveByLetter: Record<string, StandingRow[]> = {};
  for (const [name, rows] of Object.entries(standings)) {
    const letter = groupLetter(name);
    if (letter && rows.length > 0) {
      liveByLetter[letter] = [...rows].sort(
        (a, b) => b.points - a.points || b.goal_diff - a.goal_diff
      );
    }
  }

  const group = WC2026_GROUPS.find((g) => g.letter === active) ?? WC2026_GROUPS[0];
  const live = liveByLetter[active];

  // Lignes du tableau : vrai classement si dispo, sinon les 4 équipes à 0
  // (mêmes colonnes pour TOUTES les poules, avant comme pendant le tournoi).
  const tableRows: StandingRow[] = live
    ? live.slice(0, 4)
    : group.teams.map((name, i) => ({
        team_name_fr: name,
        team_flag: "",
        rank: i + 1,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        goal_diff: 0,
        points: 0,
      }));

  const poolMatches = [...(matchesByLetter[active] ?? [])].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xl">⚽</span>
        <h3 className="font-black text-sm text-white uppercase tracking-widest">Phase de groupes</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-canal-yellow/40 to-transparent" />
      </div>

      {/* Tabs — one per pool */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {WC2026_GROUPS.map((g) => (
          <button
            key={g.letter}
            onClick={() => setActive(g.letter)}
            className={cn(
              "shrink-0 w-9 h-9 rounded-lg text-sm font-black transition-colors",
              g.letter === active
                ? "bg-canal-yellow text-canal-black"
                : "bg-canal-gray-mid/60 text-canal-gray-muted hover:text-white"
            )}
          >
            {g.letter}
          </button>
        ))}
      </div>

      {/* Selected pool */}
      <div className="bg-canal-gray-mid/40 rounded-xl border border-canal-gray-light/25 p-4 mt-1">
        <p className="font-black text-canal-yellow text-xs uppercase tracking-widest mb-3">
          Groupe {group.letter}
        </p>
        {/* Tableau de points — mêmes colonnes pour toutes les poules */}
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-xs tabular-nums min-w-[320px]">
            <thead>
              <tr className="text-canal-gray-muted border-b border-canal-gray-light/30">
                <th className="text-left font-medium pb-1 pl-1">Équipe</th>
                <th className="w-6 text-center font-medium pb-1" title="Joués">J</th>
                <th className="w-6 text-center font-medium pb-1" title="Gagnés">G</th>
                <th className="w-6 text-center font-medium pb-1" title="Nuls">N</th>
                <th className="w-6 text-center font-medium pb-1" title="Défaites">D</th>
                <th className="w-12 text-center font-medium pb-1" title="Buts pour : Buts contre">BP:BC</th>
                <th className="w-8 text-center font-black text-canal-yellow pb-1" title="Points">Pts</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr
                  key={row.team_name_fr}
                  className="border-b border-canal-gray-light/15 text-canal-gray-muted"
                >
                  <td className="py-1.5 pl-1">
                    <span className="flex items-center gap-1.5">
                      <span className="font-black w-3">{i + 1}</span>
                      <TeamLink
                        name={row.team_name_fr}
                        flag={teamFlag(row.team_flag || null, row.team_name_fr)}
                        flagClassName="text-base"
                        className="max-w-[110px] font-semibold"
                      />
                    </span>
                  </td>
                  <td className="text-center">{row.played}</td>
                  <td className="text-center">{row.won}</td>
                  <td className="text-center">{row.draw}</td>
                  <td className="text-center">{row.lost}</td>
                  <td className="text-center">{row.goals_for}:{row.goals_against}</td>
                  <td className="text-center font-black text-canal-yellow">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!live && (
          <p className="text-canal-gray-muted text-[11px] italic mt-2">
            Classement à 0 — démarre au coup d&apos;envoi du tournoi.
          </p>
        )}

        {/* Matchs de la poule — mêmes disposition pour toutes les poules */}
        <div className="mt-4 pt-3 border-t border-canal-gray-light/25">
          <p className="font-black text-canal-yellow text-[11px] uppercase tracking-widest mb-1.5">
            Matchs de la poule {group.letter}
          </p>
          {poolMatches.length > 0 ? (
            <div>
              {poolMatches.map((m) => (
                <GroupMatchRow key={m.id} m={m} />
              ))}
            </div>
          ) : (
            <p className="text-canal-gray-muted text-[11px] italic py-2">
              Calendrier de la poule à venir.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

// Normalise un nom d'équipe pour le rapprochement poule (accents/casse).
function normTeam(n: string): string {
  return n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
const TEAM_LETTER: Record<string, string> = {};
for (const g of WC2026_GROUPS) for (const t of g.teams) TEAM_LETTER[normTeam(t)] = g.letter;

export function BracketFifa({ data, initialGroup }: { data: BracketData; initialGroup?: string | null }) {
  const thirdPlace = data.phases.find((p) => p.phase === "3ème place");

  // Vrais matchs de phase de groupes, regroupés par poule (A–L). Résolution :
  // lettre du stage du bucket/match, sinon appartenance des 2 équipes.
  const groupPhase = data.phases.find((p) => p.phase === "Groupe");
  const matchesByLetter: Record<string, MatchRow[]> = {};
  for (const bucket of groupPhase?.groups ?? []) {
    for (const m of bucket.matches) {
      const L =
        groupLetter(bucket.stage ?? "") ||
        groupLetter(m.stage ?? "") ||
        TEAM_LETTER[normTeam(m.team_a)] ||
        TEAM_LETTER[normTeam(m.team_b)] ||
        "";
      if (!L) continue;
      (matchesByLetter[L] ??= []).push(m);
    }
  }

  // Ordered knockout rounds (exclude groups + 3rd-place, which is shown beside the final)
  const knockout = data.phases
    .filter((p) => p.phase !== "Groupe" && p.phase !== "3ème place")
    .sort((a, b) => {
      const ia = KNOCKOUT_ORDER.indexOf(a.phase);
      const ib = KNOCKOUT_ORDER.indexOf(b.phase);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  const realRounds = knockout
    .map((p) => ({ phase: p.phase, matches: p.groups[0]?.matches ?? [] }))
    .filter((r) => r.matches.length > 0);

  // Échafaudage WC2026 (32 qualifiés) : on affiche TOUJOURS l'arbre à
  // élimination directe, même si les équipes ne sont pas encore connues.
  const SCAFFOLD: { phase: string; count: number }[] = [
    { phase: "Seizièmes", count: 16 },
    { phase: "Huitièmes", count: 8 },
    { phase: "Quarts", count: 4 },
    { phase: "Demis", count: 2 },
    { phase: "Finale", count: 1 },
  ];
  const placeholder = (phase: string, i: number): MatchRow => ({
    id: `tbd-${phase}-${i}`,
    team_a: "",
    team_b: "",
    status: "upcoming",
    starts_at: "",
  });

  const isScaffold = realRounds.length === 0;
  const rounds = isScaffold
    ? SCAFFOLD.map((s) => ({
        phase: s.phase,
        matches: Array.from({ length: s.count }, (_, i) => placeholder(s.phase, i)),
      }))
    : realRounds;

  const effectiveThird =
    thirdPlace && (thirdPlace.groups[0]?.matches.length ?? 0) > 0
      ? thirdPlace.groups[0].matches
      : isScaffold
        ? [placeholder("3eme", 0)]
        : [];

  // Bracket height scales with the widest round so connectors stay aligned
  const maxMatches = Math.max(1, ...rounds.map((r) => r.matches.length));
  const bracketHeight = Math.max(420, maxMatches * 96 + 40);

  return (
    <div className="space-y-10">
      {/* Group phase — one tab per pool (always shown for a WC bracket) */}
      <GroupTabs standings={data.standings} matchesByLetter={matchesByLetter} initialGroup={initialGroup} />

      {/* Knockout bracket — toujours affiché (échafaudé si équipes inconnues) */}
      <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏆</span>
            <h3 className="font-black text-lg text-white uppercase tracking-widest">
              Tableau final
            </h3>
            <div className="flex-1 h-px bg-gradient-to-r from-canal-yellow/50 to-transparent" />
            <span className="text-canal-gray-muted text-xs italic shrink-0 sm:hidden">← défiler →</span>
          </div>
          {isScaffold && (
            <p className="text-canal-gray-muted text-xs italic mb-3">
              Équipes déterminées à l&apos;issue de la phase de groupes — structure du tableau ci-dessous.
            </p>
          )}

          <div className="overflow-x-auto pb-4">
            <div
              className="flex items-stretch min-w-max"
              style={{ height: `${bracketHeight}px` }}
            >
              {rounds.map((round, ri) => {
                const isLast = ri === rounds.length - 1;
                return (
                  <Fragment key={round.phase}>
                    {round.phase === "Finale" ? (
                      <div className="flex flex-col shrink-0">
                        <div className={cn(HEADER_H, "flex items-center justify-center px-3")}>
                          <span className="font-black uppercase tracking-widest text-canal-yellow text-base whitespace-nowrap">
                            🏆 Finale
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-6 px-3">
                          {round.matches.map((m) => (
                            <BracketTreeCard key={m.id} match={m} big />
                          ))}
                          {effectiveThird.length > 0 && (
                            <div>
                              <p className="text-center text-canal-gray-muted text-[11px] uppercase tracking-widest font-bold mb-2">
                                🥉 Petite finale
                              </p>
                              {effectiveThird.map((m) => (
                                <BracketTreeCard key={m.id} match={m} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <RoundColumn
                          phase={round.phase}
                          matches={round.matches}
                          isLast={isLast}
                        />
                        {!isLast && (
                          <ConnectorColumn nextCount={rounds[ri + 1].matches.length} />
                        )}
                      </>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
    </div>
  );
}
