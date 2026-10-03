"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Clock3 } from "lucide-react";
import { useState } from "react";
import {
  dayLabel,
  meaningfulBadge,
  stageLabel,
  teamDisplayName,
  timeLabel,
  type ProgramMatch,
} from "@/lib/canal-sports/programme";
import { cn } from "@/lib/utils";

type TabKey = "today" | "upcoming" | "finished";

export function MobileProgramme({
  today,
  upcoming,
  finished,
  hero,
}: {
  today: ProgramMatch[];
  upcoming: ProgramMatch[];
  finished: ProgramMatch[];
  hero: ProgramMatch | null;
}) {
  const firstTab: TabKey = today.length ? "today" : upcoming.length ? "upcoming" : "finished";
  const [tab, setTab] = useState<TabKey>(firstTab);
  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "today", label: "Aujourd'hui", count: today.length },
    { key: "upcoming", label: "A venir", count: upcoming.length },
    { key: "finished", label: "Termines", count: finished.length },
  ];
  const list = tab === "today" ? today : tab === "upcoming" ? upcoming : finished;

  return (
    <div className="space-y-4 lg:hidden">
      {hero ? <MobileEventBanner match={hero} /> : null}

      <div className="sticky top-14 z-20 -mx-3 border-b border-border bg-background/95 px-3 pt-1 backdrop-blur-sm">
        <div className="relative grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
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
              <span className="relative">
                {item.label}
                {item.count > 0 ? <span className="ml-1 opacity-70">{item.count}</span> : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      {list.length ? (
        <div className="space-y-2">
          {list.map((match) => (
            <MobileMatchCard key={match.id} match={match} compact={tab === "finished"} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-card/70 px-4 py-8 text-center text-sm font-bold text-muted-foreground">
          Aucun match dans cet onglet.
        </div>
      )}
    </div>
  );
}

function MobileEventBanner({ match }: { match: ProgramMatch }) {
  return (
    <section className="rounded-lg border border-primary/25 bg-card/85 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-primary">
            {match.competitionName}
          </p>
          <p className="mt-0.5 truncate text-xs font-bold text-muted-foreground">
            {stageLabel(match.stage, match.matchday)}
          </p>
        </div>
        <StatusPill match={match} />
      </div>
      <Link href={`/cs/match/${match.id}`} className="block rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamStack team={match.home} />
          <ScoreOrTime match={match} large />
          <TeamStack team={match.away} align="right" />
        </div>
      </Link>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <span className="min-w-0 truncate text-xs font-bold text-muted-foreground">
          {match.score ? "Score final" : dayLabel(match.startsAt)}
        </span>
        <Link
          href={match.status === "finished" ? `/cs/match/${match.id}` : "/cs/pronostics"}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground transition-transform active:scale-95"
        >
          {match.status === "finished" ? "Voir" : "Pronostiquer"}
        </Link>
      </div>
    </section>
  );
}

function MobileMatchCard({ match, compact = false }: { match: ProgramMatch; compact?: boolean }) {
  return (
    <article className="rounded-lg border border-white/10 bg-card/80 p-3 transition-colors active:border-primary/45 active:bg-secondary/70">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[11px] font-bold text-muted-foreground">
          <Clock3 size={12} className="shrink-0 text-primary" />
          {dayLabel(match.startsAt)} / {timeLabel(match.startsAt)}
        </span>
        <StatusPill match={match} />
      </div>

      <Link href={`/cs/match/${match.id}`} className="block rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
        <div className={cn("grid items-center gap-2", compact ? "grid-cols-[1fr_auto]" : "grid-cols-[1fr_auto_1fr]")}>
          <TeamRow team={match.home} />
          <ScoreOrTime match={match} />
          {!compact && <TeamRow team={match.away} align="right" />}
        </div>
        {compact ? <div className="mt-2"><TeamRow team={match.away} /></div> : null}
      </Link>

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <CalendarDays size={12} className="text-primary" />
          {stageLabel(match.stage, match.matchday)}
        </span>
        <Link
          href={match.status === "finished" ? `/cs/match/${match.id}` : "/cs/pronostics"}
          className="inline-flex items-center gap-1 text-xs font-black text-primary transition-transform active:scale-95"
        >
          {match.status === "finished" ? "Voir le match" : "Pronostiquer"}
          <ChevronRight size={13} />
        </Link>
      </div>
    </article>
  );
}

function TeamStack({ team, align = "left" }: { team: ProgramMatch["home"]; align?: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-1", align === "right" && "text-right")}>
      <Logo team={team} size="lg" />
      <span className="line-clamp-2 text-center text-xs font-black leading-tight text-foreground">
        {teamDisplayName(team)}
      </span>
    </div>
  );
}

function TeamRow({ team, align = "left" }: { team: ProgramMatch["home"]; align?: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <Logo team={team} />
      <span className="min-w-0 truncate text-sm font-black text-foreground">{teamDisplayName(team)}</span>
    </div>
  );
}

function Logo({ team, size = "md" }: { team: ProgramMatch["home"]; size?: "md" | "lg" }) {
  return (
    <div className={cn("grid shrink-0 place-items-center border border-white/10 bg-white", size === "lg" ? "h-11 w-11 rounded-xl" : "h-8 w-8 rounded-lg")}>
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" className={size === "lg" ? "h-8 w-8 object-contain" : "h-5 w-5 object-contain"} loading="lazy" />
      ) : (
        <span className="text-[10px] font-black text-canal-black">{team.shortName.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function ScoreOrTime({ match, large = false }: { match: ProgramMatch; large?: boolean }) {
  if (match.score) {
    return (
      <div className={cn("text-center font-black tabular-nums text-primary", large ? "text-3xl" : "text-xl")}>
        {match.score.home}-{match.score.away}
      </div>
    );
  }
  return (
    <div className={cn("text-center font-black tabular-nums text-primary", large ? "text-2xl" : "text-lg")}>
      {timeLabel(match.startsAt)}
    </div>
  );
}

function StatusPill({ match }: { match: ProgramMatch }) {
  const badge = meaningfulBadge(match) ?? (match.status === "scheduled" ? "A venir" : null);
  if (!badge) return null;
  return (
    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase text-muted-foreground">
      {badge}
    </span>
  );
}
