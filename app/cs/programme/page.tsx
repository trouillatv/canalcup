import Link from "next/link";
import { CalendarDays, ChevronRight, Clock3, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageShell, Section, EmptyState } from "@/components/canal-sports/ui";
import { MobileProgramme } from "./MobileProgramme";
import {
  groupByDay,
  meaningfulBadge,
  matchdayLabel,
  normalizeProgramEvent,
  splitProgram,
  stageLabel,
  statusLabel,
  teamDisplayName,
  timeLabel,
  dayLabel,
  type ProgramMatch,
  type RawProgramEvent,
} from "@/lib/canal-sports/programme";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PredictionRow = {
  event_id: string;
  status: string;
  points_awarded: number | null;
};

function TeamMark({
  team,
  align = "left",
  size = "md",
}: {
  team: ProgramMatch["home"];
  align?: "left" | "right";
  size?: "md" | "lg";
}) {
  const logoSize = size === "lg" ? "h-16 w-16 md:h-20 md:w-20 rounded-2xl" : "h-9 w-9 rounded-lg";
  const imgSize = size === "lg" ? "h-12 w-12 md:h-14 md:w-14" : "h-6 w-6";
  const textSize = size === "lg" ? "text-xl md:text-3xl" : "text-sm md:text-[15px]";

  return (
    <div className={cn("flex min-w-0 items-center gap-2 md:gap-3", align === "right" && "flex-row-reverse text-right")}>
      <div className={cn("grid shrink-0 place-items-center border border-white/10 bg-white shadow-sm", logoSize)}>
        {team.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt="" className={cn("object-contain", imgSize)} loading="lazy" />
        ) : (
          <span className="text-xs font-black text-canal-black">{team.shortName.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <span className={cn("min-w-0 text-balance font-black leading-tight text-foreground", textSize)}>
        {teamDisplayName(team)}
      </span>
    </div>
  );
}

function ScoreOrTime({ match, large = false }: { match: ProgramMatch; large?: boolean }) {
  if (match.score) {
    return (
      <div className={cn("font-black tabular-nums text-primary", large ? "text-4xl md:text-5xl" : "text-xl")}>
        {match.score.home}-{match.score.away}
      </div>
    );
  }
  return (
    <div className={cn("font-black tabular-nums text-primary", large ? "text-3xl md:text-4xl" : "text-lg")}>
      {timeLabel(match.startsAt)}
    </div>
  );
}

function StatusPill({ match }: { match: ProgramMatch }) {
  const live = match.status === "live";
  const badge = meaningfulBadge(match);
  if (!badge) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-wide",
        live
          ? "border-canal-red/60 bg-canal-red/15 text-canal-red"
          : match.status === "finished"
            ? "border-white/10 bg-white/5 text-muted-foreground"
            : "border-primary/40 bg-primary/10 text-primary"
      )}
    >
      {badge}
    </span>
  );
}

function PredictionHint({ match }: { match: ProgramMatch }) {
  if (!match.prediction) return null;
  if (match.prediction.status === "settled") {
    return <span className="text-xs font-bold text-primary">{match.prediction.points ?? 0} pts</span>;
  }
  return <span className="text-xs font-bold text-muted-foreground">Pronostic enregistre</span>;
}

function MatchCard({ match, compact = false }: { match: ProgramMatch; compact?: boolean }) {
  const badge = meaningfulBadge(match);
  const actionHref = match.status === "finished" ? `/cs/match/${match.id}` : "/cs/pronostics";
  const actionLabel = match.status === "finished" ? "Voir le match" : "Pronostiquer";

  return (
    <article className="group rounded-lg border border-white/10 bg-card/85 p-3 shadow-[0_10px_35px_rgba(0,0,0,0.22)] transition-colors hover:border-primary/45 hover:bg-secondary/70">
      {badge ? (
        <div className="mb-3 flex justify-end">
          <StatusPill match={match} />
        </div>
      ) : null}

      <Link href={`/cs/match/${match.id}`} className="block rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background">
        <div className={cn("grid items-center gap-3", compact ? "grid-cols-[1fr_auto]" : "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]")}>
          <TeamMark team={match.home} />
          <div className="text-center">
            <ScoreOrTime match={match} />
          </div>
          {!compact && <TeamMark team={match.away} align="right" />}
        </div>

        {compact && (
          <div className="mt-2">
            <TeamMark team={match.away} />
          </div>
        )}
      </Link>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-2">
        <PredictionHint match={match} />
        <Link
          href={actionHref}
          className="ml-auto inline-flex items-center gap-1 text-xs font-black text-primary transition-transform group-hover:translate-x-0.5"
        >
          {actionLabel}
          <ChevronRight size={13} />
        </Link>
      </div>
    </article>
  );
}

function HeroMatch({ match }: { match: ProgramMatch }) {
  return (
    <section className="overflow-hidden rounded-lg border border-primary/25 bg-[radial-gradient(circle_at_50%_0%,rgba(255,215,0,0.18),transparent_40%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary)),#0d0b08)] shadow-[0_20px_80px_rgba(0,0,0,0.38)]">
      <div className="border-b border-white/10 px-4 py-3 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-primary">Prochaine affiche</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {match.competitionName} / {stageLabel(match.stage, match.matchday)}
            </p>
          </div>
          <StatusPill match={match} />
        </div>
      </div>

      <div className="grid gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:px-7 md:py-9">
        <TeamMark team={match.home} size="lg" />
        <div className="flex items-center justify-between gap-4 md:block md:text-center">
          <div>
            <p className="text-xs text-muted-foreground">{dayLabel(match.startsAt)}</p>
            <ScoreOrTime match={match} large />
          </div>
          <Link
            href="/cs/pronostics"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground transition-opacity hover:opacity-90"
          >
            Pronostiquer
          </Link>
        </div>
        <TeamMark team={match.away} align="right" size="lg" />
      </div>
    </section>
  );
}

function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-primary">{title}</h2>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

export default async function ProgrammePage() {
  const supabase = await createClient();
  const { data: events, error } = await supabase
    .from("events")
    .select(
      `id, starts_at, status, stage, matchday, result,
       seasons(label, competitions(name)),
       event_participants(role, participants(id, name, short_name, metadata))`
    )
    .order("starts_at", { ascending: true });

  const { data: { user } } = await supabase.auth.getUser();
  let predictionsByEvent = new Map<string, { status: string; points: number | null }>();
  if (user) {
    const { data: me } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();
    if (me) {
      const { data: predictions } = await supabase
        .from("predictions")
        .select("event_id, status, points_awarded")
        .eq("user_id", me.id);
      predictionsByEvent = new Map(
        ((predictions ?? []) as PredictionRow[]).map((p) => [
          p.event_id,
          { status: p.status, points: p.points_awarded },
        ])
      );
    }
  }

  const matches = ((events ?? []) as unknown as RawProgramEvent[])
    .map((event) => normalizeProgramEvent(event, predictionsByEvent.get(event.id) ?? null))
    .filter((match) => match.home.id || match.away.id);

  const program = splitProgram(matches);
  const upcomingGroups = groupByDay(program.upcoming.slice(0, 24));
  const todayIds = new Set(program.today.map((match) => match.id));
  const mobileUpcoming = program.upcoming.filter((match) => !todayIds.has(match.id)).slice(0, 24);
  const finished = program.finished.slice(0, 8);

  return (
    <PageShell className="max-w-7xl space-y-0 px-3 py-3 sm:px-5 lg:space-y-6 lg:px-8 lg:py-4">
      <div className="hidden space-y-1 lg:block">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">UEFA Champions League</p>
        <h1 className="canal-headline text-3xl md:text-5xl">Programme</h1>
      </div>

      {error ? (
        <Section title="Programme">
          <EmptyState icon={CalendarDays} title="Programme indisponible" description={error.message} />
        </Section>
      ) : matches.length === 0 ? (
        <Section title="Programme">
          <EmptyState
            icon={CalendarDays}
            title="Aucun match Champions League"
            description="Aucun event TARGET n'est disponible pour cette competition."
          />
        </Section>
      ) : (
        <>
          <MobileProgramme
            today={program.today}
            upcoming={mobileUpcoming}
            finished={program.finished.slice(0, 12)}
            hero={program.hero}
          />
        <div className="hidden gap-5 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.9fr)]">
          <div className="space-y-6">
            {program.hero ? <HeroMatch match={program.hero} /> : null}

            {program.today.length > 0 && (
              <section>
                <SectionHeader title="Aujourd'hui" detail="Les affiches du jour, sans donnees inventees." />
                <div className="grid gap-3 md:grid-cols-2">
                  {program.today.map((match) => <MatchCard key={match.id} match={match} />)}
                </div>
              </section>
            )}

            <section>
              <SectionHeader title="A venir" detail="Regroupe par journee de calendrier." />
              <div className="space-y-4">
                {upcomingGroups.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                      <Clock3 size={14} className="text-primary" />
                      {group.label}
                      {matchdayLabel(group.matches[0]?.matchday ?? null) ? (
                        <>
                          <span className="text-border">/</span>
                          <span>{matchdayLabel(group.matches[0].matchday)}</span>
                        </>
                      ) : null}
                    </h3>
                    <div className="grid gap-3 xl:grid-cols-2">
                      {group.matches.map((match) => <MatchCard key={match.id} match={match} />)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <section className="rounded-lg border border-white/10 bg-card/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Trophy size={16} className="text-primary" />
                <h2 className="text-sm font-black uppercase tracking-widest text-primary">Termines</h2>
              </div>
              <div className="space-y-2">
                {finished.map((match) => <MatchCard key={match.id} match={match} compact />)}
              </div>
            </section>
          </aside>
        </div>
        </>
      )}
    </PageShell>
  );
}
