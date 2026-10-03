import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronRight, MapPin, Shield, Shirt, Target, Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageShell, EmptyState } from "@/components/canal-sports/ui";
import {
  getCanalSportsMatchCenter,
  teamDisplayName,
  type MatchCenterTeam,
  type MatchCenterViewModel,
  type RecentFormResult,
  type SquadPlayer,
} from "@/lib/canal-sports/match-center";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function TeamLogo({ team, large = false }: { team: MatchCenterTeam; large?: boolean }) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center border border-white/10 bg-white shadow-sm",
        large ? "h-20 w-20 rounded-2xl md:h-28 md:w-28" : "h-10 w-10 rounded-lg"
      )}
    >
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" className={cn("object-contain", large ? "h-14 w-14 md:h-20 md:w-20" : "h-7 w-7")} />
      ) : (
        <span className="text-sm font-black text-canal-black">{team.shortName.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function HeroTeam({ team, align = "left" }: { team: MatchCenterTeam; align?: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-4", align === "right" && "flex-row-reverse text-right md:justify-start")}>
      <TeamLogo team={team} large />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{team.country ?? "Club"}</p>
        <h2 className="mt-1 max-w-full text-balance break-words text-2xl font-black leading-none text-foreground md:text-4xl">{teamDisplayName(team)}</h2>
        {team.standing ? (
          <p className="mt-2 text-xs font-bold text-muted-foreground">
            {team.standing.position}e / {team.standing.points ?? 0} pts
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ScoreBlock({ match }: { match: MatchCenterViewModel }) {
  if (match.score) {
    return (
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{match.statusLabel}</p>
        <div className="mt-1 font-black tabular-nums text-primary text-6xl md:text-7xl">
          {match.score.home}-{match.score.away}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{match.dateLabel}</p>
      <div className="mt-1 font-black tabular-nums text-primary text-5xl md:text-6xl">{match.timeLabel}</div>
      <p className="mt-1 text-xs font-bold text-muted-foreground">{match.statusLabel} / heure NC</p>
    </div>
  );
}

function Hero({ match }: { match: MatchCenterViewModel }) {
  return (
    <section className="overflow-hidden rounded-lg border border-primary/25 bg-[radial-gradient(circle_at_50%_0%,rgba(255,215,0,0.18),transparent_42%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary)),#0b0906)] shadow-[0_24px_90px_rgba(0,0,0,0.42)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">{match.competitionName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {match.stageLabel}
            {match.seasonLabel ? ` / ${match.seasonLabel}` : ""}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase text-muted-foreground">
          {match.statusLabel}
        </span>
      </div>

      <div className="grid gap-7 px-4 py-7 md:grid-cols-[minmax(0,1fr)_minmax(150px,auto)_minmax(0,1fr)] md:items-center md:px-8 md:py-10">
        <HeroTeam team={match.home} />
        <ScoreBlock match={match} />
        <HeroTeam team={match.away} align="right" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={13} className="text-primary" />
            {match.dateLabel} / {match.timeLabel} NC
          </span>
          {match.venue ? (
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} className="text-primary" />
              {match.venue}
            </span>
          ) : null}
        </div>
        {match.canPredict ? (
          <Link
            href="/cs/pronostics"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          >
            Pronostiquer
          </Link>
        ) : (
          <Link
            href="/cs/programme"
            className="inline-flex items-center gap-1 text-sm font-black text-primary transition-transform hover:translate-x-0.5"
          >
            Retour au programme <ChevronRight size={15} />
          </Link>
        )}
      </div>
    </section>
  );
}

function PredictionPanel({ match }: { match: MatchCenterViewModel }) {
  const prediction = match.prediction;
  const payload = prediction?.payload as { home?: unknown; away?: unknown } | undefined;
  const hasExactScore = typeof payload?.home === "number" && typeof payload?.away === "number";

  return (
    <section className="rounded-lg border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary)))] p-4 shadow-[0_14px_45px_rgba(0,0,0,0.24)]">
      {prediction ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
              <Target size={14} />
              Ton pronostic
            </p>
            <p className="mt-2 text-3xl font-black text-foreground tabular-nums">
              {hasExactScore ? `${payload!.home}-${payload!.away}` : "Enregistré"}
            </p>
            <p className="mt-1 text-xs font-bold text-muted-foreground">
              {prediction.statusLabel}
              {match.canPredict ? " / modifiable jusqu'au coup d'envoi" : ""}
            </p>
          </div>
          {match.canPredict ? (
            <Link href="/cs/pronostics" className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
              Modifier
            </Link>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-muted-foreground">
              Verrouillé
            </span>
          )}
        </div>
      ) : match.canPredict ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
              <Target size={14} />
              Ton pronostic
            </p>
            <p className="mt-2 text-sm font-bold text-foreground">À pronostiquer avant le coup d'envoi.</p>
          </div>
          <Link href="/cs/pronostics" className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
            Pronostiquer
          </Link>
        </div>
      ) : (
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
            <Target size={14} />
            Ton pronostic
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Aucun pronostic utilisateur disponible pour ce match.</p>
        </div>
      )}
    </section>
  );
}

function groupLabelFr(value: string | null | undefined): string {
  if (!value) return "Phase de ligue";
  return value === "League phase" ? "Phase de ligue" : value;
}

function ContextPanel({ match }: { match: MatchCenterViewModel }) {
  const teams = [match.home, match.away];
  const hasContext = teams.some((team) => team.standing || team.recentForm.length > 0);

  if (!hasContext) {
    return (
      <section className="rounded-lg border border-white/10 bg-card/70 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy size={16} className="text-primary" />
          <h2 className="text-sm font-black uppercase tracking-widest text-primary">Contexte du match</h2>
        </div>
        <p className="text-sm text-muted-foreground">Contexte sportif non disponible de façon fiable pour ces deux clubs.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-white/10 bg-card/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={16} className="text-primary" />
        <h2 className="text-sm font-black uppercase tracking-widest text-primary">Contexte du match</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {teams.map((team) => (
          <div key={team.id ?? team.name} className="rounded-lg bg-secondary/65 p-3">
            <div className="mb-3 flex items-center gap-2">
              <TeamLogo team={team} />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-foreground">{teamDisplayName(team)}</p>
                <p className="text-xs text-muted-foreground">{team.country ?? groupLabelFr(team.standing?.groupLabel)}</p>
              </div>
            </div>
            <StandingLine team={team} />
            <RecentFormLine team={team} />
          </div>
        ))}
      </div>
    </section>
  );
}

function StandingLine({ team }: { team: MatchCenterTeam }) {
  const standing = team.standing;
  if (!standing) return <p className="text-sm text-muted-foreground">Classement indisponible</p>;

  return (
    <p className="text-sm font-black text-foreground">
      {standing.position}e
      <span className="mx-2 text-muted-foreground">/</span>
      {standing.points ?? 0} pts
      {standing.goalDifference !== null ? (
        <>
          <span className="mx-2 text-muted-foreground">/</span>
          diff. {standing.goalDifference > 0 ? "+" : ""}{standing.goalDifference}
        </>
      ) : null}
    </p>
  );
}

function formTone(result: RecentFormResult): string {
  if (result === "V") return "border-emerald-400/40 bg-emerald-400/15 text-emerald-200";
  if (result === "N") return "border-white/15 bg-white/10 text-muted-foreground";
  return "border-red-400/40 bg-red-400/15 text-red-200";
}

function RecentFormLine({ team }: { team: MatchCenterTeam }) {
  if (team.recentForm.length === 0) {
    return <p className="mt-3 text-xs text-muted-foreground">Forme récente indisponible</p>;
  }

  return (
    <div className="mt-3">
      <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Forme récente</p>
      <div className="flex flex-wrap gap-1.5">
        {team.recentForm.map((entry) => (
          <span
            key={`${entry.eventId}-${entry.result}`}
            className={cn("grid h-7 w-7 place-items-center rounded-full border text-xs font-black", formTone(entry.result))}
            title={`${entry.goalsFor}-${entry.goalsAgainst}`}
          >
            {entry.result}
          </span>
        ))}
      </div>
    </div>
  );
}
function positionGroup(position: string | null): string {
  const value = (position ?? "").toLowerCase();
  if (value.includes("goal")) return "Gardiens";
  if (value.includes("def")) return "Défenseurs";
  if (value.includes("mid")) return "Milieux";
  if (value.includes("attack") || value.includes("forward") || value.includes("offence")) return "Attaquants";
  return "Autres";
}

function positionLabel(position: string | null): string | null {
  const value = (position ?? "").toLowerCase();
  if (!value) return null;
  if (value.includes("goal")) return "Gardien";
  if (value.includes("def")) return "Défenseur";
  if (value.includes("mid")) return "Milieu";
  if (value.includes("attack") || value.includes("forward") || value.includes("offence")) return "Attaquant";
  return null;
}

function groupPlayers(players: SquadPlayer[]) {
  const groups = new Map<string, SquadPlayer[]>();
  for (const player of players) {
    const group = positionGroup(player.position);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(player);
  }
  const order = ["Gardiens", "Défenseurs", "Milieux", "Attaquants", "Autres"];
  return order
    .filter((label) => groups.has(label))
    .map((label) => ({ label, players: groups.get(label)! }));
}

function SquadList({ team }: { team: MatchCenterTeam }) {
  const visible = team.squad.slice(0, 6);
  const groups = groupPlayers(team.squad);
  return (
    <div className="rounded-lg border border-white/10 bg-card/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TeamLogo team={team} />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-foreground">{teamDisplayName(team)}</p>
            <p className="text-xs text-muted-foreground">{team.squad.length} joueurs référencés</p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-black text-primary">
          {team.squadStatus === "available" ? "Saison" : team.squadStatus === "partial" ? "Partiel" : "Vide"}
        </span>
      </div>
      {visible.length > 0 ? (
        <>
          <div className="space-y-2 lg:hidden">
            {visible.map((player) => <PlayerRow key={player.id} player={player} />)}
            {team.squad.length > visible.length ? (
              <details className="group pt-1">
                <summary className="cursor-pointer list-none text-xs font-black text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary">
                  Voir l'effectif complet
                </summary>
                <div className="mt-3 space-y-4">
                  <SquadGroups groups={groups} />
                </div>
              </details>
            ) : null}
          </div>
          <div className="hidden space-y-4 lg:block">
            <SquadGroups groups={groups} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune donnée d'effectif exploitable pour ce club.</p>
      )}
    </div>
  );
}

function SquadGroups({ groups }: { groups: { label: string; players: SquadPlayer[] }[] }) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">{group.label}</p>
          <div className="space-y-2">
            {group.players.map((player) => <PlayerRow key={player.id} player={player} />)}
          </div>
        </div>
      ))}
    </>
  );
}
function PlayerRow({ player }: { player: SquadPlayer }) {
  const displayPosition = positionLabel(player.position);
  return (
    <div className="flex items-center gap-2 rounded-md bg-secondary/55 px-2 py-2">
      <Shirt size={14} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{player.name}</span>
      {displayPosition ? <span className="shrink-0 text-[11px] text-muted-foreground">{displayPosition}</span> : null}
    </div>
  );
}

function SquadsPanel({ match }: { match: MatchCenterViewModel }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Users size={16} className="text-primary" />
        <h2 className="text-sm font-black uppercase tracking-widest text-primary">Effectifs</h2>
      </div>
      <p className="mb-3 text-xs font-bold text-muted-foreground">Effectif de saison / pas la composition du match.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <SquadList team={match.home} />
        <SquadList team={match.away} />
      </div>
    </section>
  );
}

function ScorersPanel({ match }: { match: MatchCenterViewModel }) {
  if (!match.hasSeasonScorers) return null;
  return (
    <section className="rounded-lg border border-white/10 bg-card/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Shield size={16} className="text-primary" />
        <h2 className="text-sm font-black uppercase tracking-widest text-primary">Buteurs de la compétition</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[match.home, match.away].map((team) => (
          <div key={team.id ?? team.name} className="rounded-lg bg-secondary/60 p-3">
            <p className="mb-2 text-xs font-black uppercase text-muted-foreground">{teamDisplayName(team)}</p>
            {team.seasonScorers.length > 0 ? (
              <div className="space-y-2">
                {team.seasonScorers.map((scorer) => (
                  <div key={scorer.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-bold text-foreground">{scorer.playerName}</span>
                    <span className="font-black text-primary">{scorer.goals}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun buteur référencé.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function MatchCenterPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const result = await getCanalSportsMatchCenter(eventId, user?.id ?? null, supabase);

  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) {
    return (
      <PageShell className="max-w-7xl px-3 sm:px-5 lg:px-8">
        <EmptyState icon={CalendarDays} title="Match indisponible" description={result.message} />
      </PageShell>
    );
  }

  const { match } = result;

  return (
    <PageShell className="max-w-7xl px-3 sm:px-5 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/cs/programme" className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary">
          Programme
        </Link>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Match Center</p>
      </div>

      <Hero match={match} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.8fr)]">
        <div className="space-y-5">
          <PredictionPanel match={match} />
          <SquadsPanel match={match} />
        </div>
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <ContextPanel match={match} />
          <ScorersPanel match={match} />
        </aside>
      </div>
    </PageShell>
  );
}
