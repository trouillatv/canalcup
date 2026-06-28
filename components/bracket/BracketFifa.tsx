"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { teamFlag, cn } from "@/lib/utils";
import { WC2026_GROUPS } from "@/lib/football/groups-2026";
import { resolveKnockout, type ResolvedSlot, type ResolvedRound } from "@/lib/football/bracket-2026";
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

  // Explication du départage : pour chaque paire adjacente à égalité de points,
  // on indique le critère qui sépare (diff de buts, puis buts marqués). Les
  // critères « confrontation directe » et « fair-play » ne sont pas calculables
  // ici (pas de données) → renvoyés au libellé générique. Affiché seulement
  // quand le tournoi a démarré (sinon tout est à 0 = bruit).
  const fmtDiff = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const tieNotes = live
    ? tableRows
        .slice(0, -1)
        .map((a, i) => ({ a, b: tableRows[i + 1] }))
        .filter(({ a, b }) => a.points === b.points && (a.played > 0 || b.played > 0))
        .map(({ a, b }) => {
          const reason =
            a.goal_diff !== b.goal_diff
              ? `meilleure différence de buts (${fmtDiff(a.goal_diff)} vs ${fmtDiff(b.goal_diff)})`
              : a.goals_for !== b.goals_for
                ? `plus de buts marqués (${a.goals_for} vs ${b.goals_for})`
                : `critères FIFA (confrontation directe, fair-play)`;
          return { top: a.team_name_fr, bottom: b.team_name_fr, reason };
        })
    : [];

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

        {/* Explications de départage (égalités de points) */}
        {tieNotes.length > 0 && (
          <div className="mt-2 space-y-1">
            {tieNotes.map((t, i) => (
              <p key={i} className="text-[11px] text-canal-gray-muted flex items-start gap-1.5">
                <span className="text-canal-yellow shrink-0">⚖</span>
                <span>
                  <span className="font-bold text-white">{t.top}</span> devant{" "}
                  <span className="font-semibold">{t.bottom}</span> : {t.reason}
                </span>
              </p>
            ))}
          </div>
        )}

        {/* Règles officielles de départage FIFA 2026 (dépliable) */}
        <details className="mt-2 text-[11px] text-canal-gray-muted group">
          <summary className="cursor-pointer hover:text-white select-none font-semibold list-none flex items-center gap-1">
            <span className="text-canal-yellow">⚖</span> Règles de départage FIFA
            <span className="text-canal-gray-muted/60 group-open:hidden"> ▸</span>
            <span className="text-canal-gray-muted/60 hidden group-open:inline"> ▾</span>
          </summary>
          <ol className="list-decimal list-inside mt-1.5 space-y-0.5 pl-1 text-canal-gray-muted/90">
            <li>Plus grand nombre de points</li>
            <li>Confrontation directe : points entre équipes à égalité</li>
            <li>Confrontation directe : différence de buts</li>
            <li>Confrontation directe : buts marqués</li>
            <li>Différence de buts générale</li>
            <li>Buts marqués au total</li>
            <li>Fair-play (jaune −1, rouge −3/−4)</li>
            <li>Classement mondial FIFA</li>
          </ol>
        </details>

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

// ─── Tableau final PROJETÉ (échafaudage WC2026, équipes pas encore connues) ───
// On affiche TOUJOURS l'arbre complet (Seizièmes→Finale) à partir de la matrice
// officielle FIFA : emplacements (1er A, 2e B, 3e C·E·F·H·I) + équipes
// provisoires si la phase de groupes a déjà des données. 0 API / 0 IA / 0 base.

function ProjSlotLine({ slot, big }: { slot: ResolvedSlot; big?: boolean }) {
  if (slot.teamName) {
    return (
      <div className="px-2.5 py-1.5">
        <span className="flex items-center gap-1 min-w-0">
          {slot.confirmed && (
            <span className="shrink-0 text-green-400 font-black text-sm leading-none" title="Qualifié — position actée">✓</span>
          )}
          <TeamLink
            name={slot.teamName}
            flag={teamFlag(slot.teamFlag || null, slot.teamName)}
            flagClassName={big ? "text-2xl" : "text-lg"}
            className={cn("font-bold", big ? "text-base" : "text-sm", slot.confirmed ? "text-green-300" : "text-white")}
            wrapperClassName="min-w-0 flex-1"
          />
        </span>
        <span className="block pl-[26px] text-[9px] text-canal-gray-muted truncate leading-tight">
          {slot.sub}
          {slot.confirmed ? <span className="text-green-400/80"> · validé</span> : <span className="text-canal-yellow/70"> · prov.</span>}
        </span>
      </div>
    );
  }
  return (
    <div className="px-2.5 py-2">
      <span className={cn("font-semibold text-canal-gray-muted", big ? "text-sm" : "text-xs")}>{slot.label}</span>
    </div>
  );
}

function ProjCard({ match, big }: { match: ResolvedRound["matches"][number]; big?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-all bg-canal-gray-mid/30",
        big ? "w-64 border-canal-yellow/40 shadow-[0_0_40px_rgba(255,215,0,0.18)]" : "w-52 border-canal-gray-light/40"
      )}
    >
      <div className="flex items-center justify-between px-2.5 pt-1.5">
        <span className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">{match.code}</span>
      </div>
      <ProjSlotLine slot={match.a} big={big} />
      <div className="h-px bg-canal-gray-light/30 mx-2.5" />
      <ProjSlotLine slot={match.b} big={big} />
    </div>
  );
}

function ProjectionKnockout({
  standings,
  realByPhase,
  thirdPlace,
}: {
  standings: Record<string, StandingRow[]>;
  realByPhase: Record<string, MatchRow[]>;
  thirdPlace: MatchRow[];
}) {
  const [mode, setMode] = useState<"projection" | "reel">("projection");
  // Vrais matchs KO (tous tours) → propagation des qualifiés dans les slots
  // « Vainqueur Sx » des tours suivants (ex. Canada en 8e après son 16e gagné).
  const allRealKo = Object.values(realByPhase).flat();
  const rounds = resolveKnockout(standings, mode, allRealKo);

  const maxMatches = Math.max(1, ...rounds.map((r) => r.matches.length));
  // Hauteur = 1 cellule flex-1 par match du tour le plus large. 120px/cellule
  // garantit que la carte projetée la plus haute (2 équipes + sous-libellé,
  // ~107px) tient SANS déborder, sinon justify-around se tasse et les
  // connecteurs décrochent en bas du tableau (ex. S13→H7). +48 = en-tête.
  const bracketHeight = Math.max(480, maxMatches * 120 + 48);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-2xl">🏆</span>
        <h3 className="font-black text-lg text-white uppercase tracking-widest">Tableau final</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-canal-yellow/50 to-transparent min-w-[20px]" />
        {/* Toggle Projection / Réel */}
        <div className="flex items-center rounded-lg bg-canal-gray-mid/60 p-0.5 shrink-0">
          <button
            onClick={() => setMode("projection")}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors",
              mode === "projection" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
            )}
          >
            🔮 Projection
          </button>
          <button
            onClick={() => setMode("reel")}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors",
              mode === "reel" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
            )}
          >
            🔒 Réel
          </button>
        </div>
      </div>

      <p className="text-[11px] mb-3 flex items-center gap-1.5">
        {mode === "projection" ? (
          <span className="text-canal-yellow/90">
            ⚠ <span className="font-bold">Projection actuelle</span> — d&apos;après les classements provisoires. Les positions se figent à la fin des poules.
          </span>
        ) : (
          <span className="text-canal-gray-muted italic">
            Mode réel — seules les places déjà actées sont affichées. La matrice officielle FIFA est montrée en attendant.
          </span>
        )}
      </p>

      {Object.values(realByPhase).some((a) => a.length > 0) && (
        <p className="text-[11px] mb-3 flex items-center gap-1.5 text-green-300">
          👉 <span className="font-bold">Phase finale ouverte</span> — clique un match pour parier le score.
        </p>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex items-stretch min-w-max" style={{ height: `${bracketHeight}px` }}>
          {/* Rail des deux moitiés : haut = Partie A (→ Demi 1), bas = Partie B
              (→ Demi 2). Les deux blocs flex-1 s'alignent pile sur les 8 16es du
              haut / du bas. Elles ne se croisent qu'en finale. */}
          <div className="flex flex-col shrink-0 w-7 sm:w-9">
            <div className={HEADER_H} />
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex items-center justify-center border-r-2 border-canal-yellow/30">
                <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-black uppercase tracking-[0.25em] text-canal-yellow/80 whitespace-nowrap">
                  🔼 Partie A · haute
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center border-r-2 border-t-2 border-sky-400/30">
                <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-black uppercase tracking-[0.25em] text-sky-300/80 whitespace-nowrap">
                  🔽 Partie B · basse
                </span>
              </div>
            </div>
          </div>
          {rounds.map((round, ri) => {
            const isLast = ri === rounds.length - 1;
            const emoji = PHASE_EMOJIS[round.round] ?? "⚽";
            const label = PHASE_LABELS[round.round] ?? round.round;
            const isFinale = round.round === "Finale";
            // Tour JOUABLE : si les vrais matchs existent en base (équipes
            // connues), on les affiche — cliquables, score live — à la place des
            // emplacements projetés. Sinon « Vainqueur Sx » de la matrice FIFA.
            const real = [...(realByPhase[round.round] ?? [])].sort(
              (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
            );
            const hasReal = real.length > 0;
            return (
              <Fragment key={round.round}>
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
                  <div className={cn("flex-1 flex flex-col px-1", isFinale && "justify-center")}>
                    {hasReal
                      ? real.map((m) => (
                          <div
                            key={m.id}
                            className={cn("flex items-center justify-center", !isFinale && "flex-1")}
                          >
                            <div className="relative">
                              <BracketTreeCard match={m} big={isFinale} />
                              {!isLast && (
                                <span className="absolute left-full top-1/2 -translate-y-1/2 h-px w-2 bg-canal-yellow/25" />
                              )}
                            </div>
                          </div>
                        ))
                      : round.matches.map((m) => (
                          <div
                            key={m.code}
                            className={cn("flex items-center justify-center", !isFinale && "flex-1")}
                          >
                            <div className="relative">
                              <ProjCard match={m} big={isFinale} />
                              {!isLast && (
                                <span className="absolute left-full top-1/2 -translate-y-1/2 h-px w-2 bg-canal-yellow/25" />
                              )}
                            </div>
                          </div>
                        ))}
                    {isFinale && thirdPlace.length > 0 && (
                      <div className="mt-4">
                        <p className="text-center text-canal-gray-muted text-[11px] uppercase tracking-widest font-bold mb-2">
                          🥉 Petite finale
                        </p>
                        {thirdPlace.map((m) => (
                          <BracketTreeCard key={m.id} match={m} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {!isLast && <ConnectorColumn nextCount={rounds[ri + 1].matches.length} />}
              </Fragment>
            );
          })}
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

  // Vrais matchs à élimination directe, regroupés par phase. Dès qu'ils existent
  // en base (équipes qualifiées connues, ex. 16es), le tableau les rend
  // cliquables et jouables au prono ; les tours suivants restent en échafaudage
  // projeté (« Vainqueur Sx ») jusqu'à ce qu'API-Football crée les vrais matchs.
  const KO_PHASES = ["Seizièmes", "Huitièmes", "Quarts", "Demis", "Finale"];
  const realByPhase: Record<string, MatchRow[]> = {};
  for (const p of data.phases) {
    if (KO_PHASES.includes(p.phase)) {
      realByPhase[p.phase] = p.groups.flatMap((g) => g.matches);
    }
  }
  const thirdPlaceMatches = thirdPlace?.groups[0]?.matches ?? [];

  return (
    <div className="space-y-10">
      {/* Group phase — one tab per pool (always shown for a WC bracket) */}
      <GroupTabs standings={data.standings} matchesByLetter={matchesByLetter} initialGroup={initialGroup} />

      {/* Tableau final : matrice FIFA projetée, enrichie des vrais matchs dès
          qu'ils existent (16es ouverts au prono, suite en « Vainqueur Sx »). */}
      <ProjectionKnockout
        standings={data.standings}
        realByPhase={realByPhase}
        thirdPlace={thirdPlaceMatches}
      />
    </div>
  );
}
