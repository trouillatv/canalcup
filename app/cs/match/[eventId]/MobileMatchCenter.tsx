"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useState } from "react";
import { CalendarDays, ChevronRight, MapPin, Target, Users } from "lucide-react";
import { SquadDisclosure } from "./SquadDisclosure";
import type { MatchCenterTeam, MatchCenterViewModel, SquadPlayer } from "@/lib/canal-sports/match-center";
import { teamDisplayName } from "@/lib/canal-sports/match-center";
import { cn } from "@/lib/utils";

type TabKey = "context" | "squads" | "prediction";

export function MobileMatchCenter({ match }: { match: MatchCenterViewModel }) {
  const [tab, setTab] = useState<TabKey>("context");
  const tabs: { key: TabKey; label: string }[] = [
    { key: "context", label: "Contexte" },
    { key: "squads", label: "Effectifs" },
    { key: "prediction", label: "Pronostic" },
  ];

  return (
    <div className="space-y-4 lg:hidden">
      <Link href="/cs/programme" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-muted-foreground">
        Programme
      </Link>

      <section className="rounded-lg border border-primary/25 bg-card/85 p-3">
        <div className="mb-3 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">{match.competitionName}</p>
          <p className="mt-1 text-xs font-bold text-muted-foreground">{match.stageLabel}</p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamStack team={match.home} />
          <ScoreBlock match={match} />
          <TeamStack team={match.away} />
        </div>

        <div className="mt-3 flex justify-center">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase text-muted-foreground">
            {match.statusLabel}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-white/10 pt-3 text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} className="text-primary" />
            {match.dateLabel} / {match.timeLabel} NC
          </span>
          {match.venue ? (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} className="text-primary" />
              {match.venue}
            </span>
          ) : null}
        </div>

        {match.canPredict ? (
          <Link
            href="/cs/pronostics"
            className="mt-3 flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-black text-primary-foreground transition-transform active:scale-95"
          >
            Pronostiquer
          </Link>
        ) : null}
      </section>

      <div className="sticky top-14 z-20 -mx-3 border-b border-border bg-background/95 px-3 pt-1 backdrop-blur-sm">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "relative rounded-md px-2 py-2 text-[11px] font-black transition-colors",
                tab === item.key ? "text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {tab === item.key && (
                <span className="absolute inset-0 rounded-md bg-primary motion-safe:animate-[cs-tab-snap_160ms_ease-out]" />
              )}
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "context" && <MobileContext match={match} />}
      {tab === "squads" && <MobileSquads match={match} />}
      {tab === "prediction" && <MobilePrediction match={match} />}
    </div>
  );
}

function TeamStack({ team }: { team: MatchCenterTeam }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <TeamLogo team={team} />
      <span className="line-clamp-2 text-xs font-black leading-tight text-foreground">{teamDisplayName(team)}</span>
      {team.standing ? <span className="text-[10px] font-bold text-muted-foreground">{team.standing.position}e / {team.standing.points ?? 0} pts</span> : null}
    </div>
  );
}

function TeamLogo({ team }: { team: MatchCenterTeam }) {
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-white">
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" className="h-9 w-9 object-contain" />
      ) : (
        <span className="text-xs font-black text-canal-black">{team.shortName.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function ScoreBlock({ match }: { match: MatchCenterViewModel }) {
  if (match.score) {
    return (
      <div className="cs-mobile-score text-center">
        <div className="text-4xl font-black tabular-nums text-primary">
          {match.score.home}-{match.score.away}
        </div>
      </div>
    );
  }
  return (
    <div className="cs-mobile-score text-center">
      <div className="text-3xl font-black tabular-nums text-primary">{match.timeLabel}</div>
      <p className="mt-0.5 text-[10px] font-black uppercase text-muted-foreground">A venir</p>
    </div>
  );
}

function MobileContext({ match }: { match: MatchCenterViewModel }) {
  return (
    <section className="space-y-3 motion-safe:animate-[cs-mobile-panel_180ms_ease-out]">
      {[match.home, match.away].map((team) => (
        <div key={team.id ?? team.name} className="rounded-lg border border-white/10 bg-card/70 p-3">
          <div className="flex items-center gap-2">
            <TeamLogo team={team} />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-foreground">{teamDisplayName(team)}</p>
              <p className="text-xs text-muted-foreground">{team.country ?? "Club"}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-foreground">
            {team.standing ? (
              <>
                <span>{team.standing.position}e</span>
                <span>{team.standing.points ?? 0} pts</span>
                {team.standing.goalDifference !== null ? <span>diff. {team.standing.goalDifference > 0 ? "+" : ""}{team.standing.goalDifference}</span> : null}
              </>
            ) : (
              <span className="text-muted-foreground">Classement indisponible</span>
            )}
          </div>
          <RecentForm team={team} />
        </div>
      ))}
    </section>
  );
}

function RecentForm({ team }: { team: MatchCenterTeam }) {
  if (!team.recentForm.length) return <p className="mt-3 text-xs font-bold text-muted-foreground">Forme recente indisponible</p>;
  return (
    <div className="mt-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Forme recente</p>
      <div className="flex flex-wrap gap-1.5">
        {team.recentForm.map((entry, index) => (
          <span
            key={`${entry.eventId}-${entry.result}`}
            className={cn("grid h-7 w-7 place-items-center rounded-full border text-xs font-black", formTone(entry.result))}
            style={{ animationDelay: `${index * 35}ms` } as CSSProperties}
            title={`${entry.goalsFor}-${entry.goalsAgainst}`}
          >
            {entry.result}
          </span>
        ))}
      </div>
    </div>
  );
}

function formTone(result: "V" | "N" | "D"): string {
  if (result === "V") return "border-emerald-400/40 bg-emerald-400/15 text-emerald-200";
  if (result === "N") return "border-white/15 bg-white/10 text-muted-foreground";
  return "border-red-400/40 bg-red-400/15 text-red-200";
}

function MobileSquads({ match }: { match: MatchCenterViewModel }) {
  return (
    <section className="space-y-3 motion-safe:animate-[cs-mobile-panel_180ms_ease-out]">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
        <Users size={14} className="text-primary" />
        Effectif de saison / pas la composition du match.
      </div>
      {[match.home, match.away].map((team) => (
        <MobileSquadCard key={team.id ?? team.name} team={team} />
      ))}
    </section>
  );
}

function MobileSquadCard({ team }: { team: MatchCenterTeam }) {
  const preview = team.squad.slice(0, 6);
  const groups = groupPlayers(team.squad);
  return (
    <div className="rounded-lg border border-white/10 bg-card/70 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TeamLogo team={team} />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-foreground">{teamDisplayName(team)}</p>
            <p className="text-xs text-muted-foreground">{team.squad.length} joueurs references</p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-primary">
          {team.squadStatus === "available" ? "Saison" : team.squadStatus === "partial" ? "Partiel" : "Vide"}
        </span>
      </div>
      {preview.length ? (
        <SquadDisclosure preview={preview} groups={groups} total={team.squad.length} />
      ) : (
        <p className="text-sm text-muted-foreground">Aucune donnee d'effectif exploitable pour ce club.</p>
      )}
    </div>
  );
}

function MobilePrediction({ match }: { match: MatchCenterViewModel }) {
  const payload = match.prediction?.payload as { home?: unknown; away?: unknown } | undefined;
  const hasExactScore = typeof payload?.home === "number" && typeof payload?.away === "number";
  return (
    <section className="rounded-lg border border-primary/20 bg-card/80 p-4 motion-safe:animate-[cs-mobile-panel_180ms_ease-out]">
      <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
        <Target size={14} />
        Ton pronostic
      </p>
      {match.prediction ? (
        <>
          <p className="text-3xl font-black tabular-nums text-foreground">
            {hasExactScore ? `${payload!.home}-${payload!.away}` : "Enregistre"}
          </p>
          <p className="mt-1 text-xs font-bold text-muted-foreground">{match.prediction.statusLabel}</p>
        </>
      ) : (
        <p className="text-sm font-bold text-muted-foreground">Aucun pronostic utilisateur disponible pour ce match.</p>
      )}
      {match.canPredict ? (
        <Link
          href="/cs/pronostics"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground transition-transform active:scale-95"
        >
          {match.prediction ? "Modifier" : "Pronostiquer"}
        </Link>
      ) : (
        <Link href="/cs/programme" className="mt-4 inline-flex items-center gap-1 text-sm font-black text-primary">
          Retour au programme <ChevronRight size={15} />
        </Link>
      )}
    </section>
  );
}

function positionGroup(position: string | null): string {
  const value = (position ?? "").toLowerCase();
  if (value.includes("goal")) return "Gardiens";
  if (value.includes("def")) return "Defenseurs";
  if (value.includes("mid")) return "Milieux";
  if (value.includes("attack") || value.includes("forward") || value.includes("offence")) return "Attaquants";
  return "Autres";
}

function groupPlayers(players: SquadPlayer[]) {
  const groups = new Map<string, SquadPlayer[]>();
  for (const player of players) {
    const group = positionGroup(player.position);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(player);
  }
  const order = ["Gardiens", "Defenseurs", "Milieux", "Attaquants", "Autres"];
  return order
    .filter((label) => groups.has(label))
    .map((label) => ({ label, players: groups.get(label)! }));
}
