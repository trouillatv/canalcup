"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PlayerCard, PlayerFormMatch } from "@/lib/football/player-card-types";
import { ratingPillClass, formDotClass } from "@/lib/football/player-card-types";

// ─── Perf d'un match (onglet "Match", ouvert depuis le centre du match) ────────
export interface MatchPerf {
  matchId: string;
  teamA: string;
  teamB: string;
  scoreA: number | null;
  scoreB: number | null;
  rating: number | null;
  minutes: number | null;
  started: boolean | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  shots: number;
  passes: number;
  keyPasses: number | null;
  dribbles: number;
  duelsWon: number | null;
  // Événements du joueur (minute + libellé) pour la timeline.
  timeline: { minute: number; icon: string; label: string }[];
}

function photoUrl(id: string): string {
  return `https://media.api-sports.io/football/players/${id}.png`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Header ─────────────────────────────────────────────────────────────────
function Header({ card, compact }: { card: PlayerCard; compact?: boolean }) {
  const { bio, meta, id } = card;
  const [imgOk, setImgOk] = useState(true);
  const name = bio?.name || meta?.teamName ? bio?.name ?? `Joueur #${id}` : `Joueur #${id}`;
  const url = bio?.photo ?? photoUrl(id);
  const number = bio?.number ?? meta?.number ?? null;
  const positionFr = meta?.positionFr ?? bio?.position ?? null;

  return (
    <div className="flex items-center gap-3">
      <div className={cn("rounded-full bg-canal-gray-mid border-2 border-white/80 overflow-hidden flex items-center justify-center shrink-0", compact ? "w-14 h-14" : "w-20 h-20")}>
        {imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="w-full h-full object-cover" onError={() => setImgOk(false)} />
        ) : (
          <span className="text-white font-black text-lg">{number ?? "?"}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("font-black text-white leading-tight truncate", compact ? "text-base" : "text-xl")}>{name}</p>
        <div className="flex items-center gap-2 text-xs text-canal-gray-muted flex-wrap mt-0.5">
          {meta?.teamSlug ? (
            <Link href={`/wc-team/${meta.teamSlug}`} className="text-canal-yellow font-bold hover:underline">
              {meta.teamName}
            </Link>
          ) : meta?.teamName ? (
            <span className="text-canal-yellow font-bold">{meta.teamName}</span>
          ) : bio?.nationality ? (
            <span>{bio.nationality}</span>
          ) : null}
          {positionFr && <span>· {positionFr}</span>}
          {number != null && <span>· #{number}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-canal-gray-muted flex-wrap mt-1">
          {bio?.age != null && <span>{bio.age} ans</span>}
          {meta?.club && <span>· {meta.club}</span>}
          {meta?.value && <span className="text-white font-bold">· {meta.value}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Indice Dangerosité ───────────────────────────────────────────────────────
function DangerCard({ card }: { card: PlayerCard }) {
  const d = card.danger;
  if (!d) return null;
  const barColor = d.score >= 85 ? "bg-red-500" : d.score >= 60 ? "bg-orange-500" : d.score >= 40 ? "bg-canal-yellow" : "bg-canal-gray-light";
  return (
    <div className="rounded-2xl bg-gradient-to-br from-canal-gray-mid to-canal-gray border border-canal-yellow/20 px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-black text-canal-yellow uppercase tracking-wider">Indice Dangerosité</span>
        <span className="text-2xl font-black text-white tabular-nums">
          {d.emoji} {d.score}<span className="text-sm text-canal-gray-muted">/100</span>
        </span>
      </div>
      <div className="h-2 bg-canal-gray-mid rounded-full overflow-hidden mb-1.5">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${d.score}%` }} />
      </div>
      <p className="text-xs text-canal-gray-muted leading-snug">
        {d.label}
        {!d.confident && <span className="italic"> · indicatif (peu de notes officielles)</span>}
      </p>
    </div>
  );
}

// ─── Onglet Forme ───────────────────────────────────────────────────────────
function FormTab({ card }: { card: PlayerCard }) {
  if (!card.form.length) {
    return <p className="text-center text-canal-gray-muted text-sm py-10">Pas encore de match joué tracké.</p>;
  }
  // Mini-forme : plus ancien à gauche → on inverse (form est récent d'abord).
  const dots = [...card.form].reverse();
  return (
    <div className="space-y-4 py-2">
      <div className="rounded-2xl bg-canal-gray-mid px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider">5 derniers matchs</span>
          {card.formAvg != null && (
            <span className="text-xs text-canal-gray-muted">Moyenne <span className="text-white font-black">{card.formAvg.toFixed(2)}</span></span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          {dots.map((m) => (
            <div key={m.matchId} className="flex flex-col items-center gap-1 flex-1">
              <span className={cn("w-3 h-3 rounded-full", formDotClass(m.rating))} />
              <span className="text-[11px] font-black text-white tabular-nums">{m.rating != null ? m.rating.toFixed(1) : "—"}</span>
            </div>
          ))}
        </div>
      </div>
      <MatchList matches={card.form} />
    </div>
  );
}

// ─── Onglet Mondial ───────────────────────────────────────────────────────────
function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-canal-gray-mid rounded-xl px-2 py-2 text-center">
      <p className="font-black text-xl text-white tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] text-canal-gray-muted uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
function WorldCupTab({ card }: { card: PlayerCard }) {
  const wc = card.wc;
  if (!wc.matches) {
    return <p className="text-center text-canal-gray-muted text-sm py-10">Aucune statistique Mondial pour l&apos;instant.</p>;
  }
  return (
    <div className="space-y-3 py-2">
      <p className="text-xs font-black text-canal-yellow uppercase tracking-wider">Coupe du Monde 2026</p>
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Matchs" value={wc.matches} />
        <StatBox label="Minutes" value={wc.minutes} />
        <StatBox label="Note moy" value={wc.avgRating != null ? wc.avgRating.toFixed(2) : "—"} />
        <StatBox label="⚽ Buts" value={wc.goals} />
        <StatBox label="🎯 Passes D" value={wc.assists} />
        <StatBox label="🟨 / 🟥" value={`${wc.yellowCards}/${wc.redCards}`} />
      </div>
      <MatchList matches={card.form} />
    </div>
  );
}

// ─── Liste de matchs (cliquables → centre du match) ────────────────────────────
function MatchList({ matches }: { matches: PlayerFormMatch[] }) {
  if (!matches.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider">Derniers matchs</p>
      {matches.map((m) => {
        const badges = [
          ...Array(m.goals).fill("⚽"),
          ...Array(m.assists).fill("🎯"),
          ...Array(m.yellowCards).fill("🟨"),
          ...Array(m.redCards).fill("🟥"),
        ].join(" ");
        return (
          <Link
            key={m.matchId}
            href={`/matches/${m.matchId}`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-canal-gray-mid hover:bg-canal-gray-light transition-colors"
          >
            <span className="text-[10px] text-canal-gray-muted w-10 shrink-0">{fmtDate(m.date)}</span>
            <span className="flex-1 min-w-0 truncate text-xs text-white font-bold">
              {m.teamA} <span className="text-canal-gray-muted tabular-nums">{m.scoreA ?? "-"}-{m.scoreB ?? "-"}</span> {m.teamB}
            </span>
            {badges && <span className="text-[11px] shrink-0">{badges}</span>}
            <span className={cn("text-xs font-black tabular-nums px-1.5 py-0.5 rounded shrink-0", ratingPillClass(m.rating))}>
              {m.rating != null ? m.rating.toFixed(1) : "—"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Onglet Match (perf sur le match courant) ──────────────────────────────────
function MatchTab({ perf }: { perf: MatchPerf }) {
  const contrib: { icon: string; label: string; value: number | null }[] = [
    { icon: "⚽", label: "Tirs", value: perf.shots },
    { icon: "🎯", label: "Passes clés", value: perf.keyPasses },
    { icon: "🪄", label: "Dribbles réussis", value: perf.dribbles },
    { icon: "🛡️", label: "Duels gagnés", value: perf.duelsWon },
    { icon: "📨", label: "Passes", value: perf.passes },
  ];
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between rounded-2xl bg-canal-gray-mid px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-canal-gray-muted truncate">
            {perf.teamA} {perf.scoreA ?? "-"}-{perf.scoreB ?? "-"} {perf.teamB}
          </p>
          <p className="text-[11px] text-canal-gray-muted mt-0.5">
            {perf.started === true ? "Titulaire" : perf.started === false ? "Remplaçant" : ""}
            {perf.minutes != null && ` · ${perf.minutes}'`}
          </p>
        </div>
        <span className={cn("text-lg font-black tabular-nums px-2.5 py-1 rounded", ratingPillClass(perf.rating))}>
          {perf.rating != null ? perf.rating.toFixed(1) : "—"}
        </span>
      </div>

      {(perf.goals > 0 || perf.assists > 0) && (
        <div className="flex items-center gap-3 text-sm text-white font-bold">
          {perf.goals > 0 && <span>⚽ {perf.goals} but{perf.goals > 1 ? "s" : ""}</span>}
          {perf.assists > 0 && <span>🎯 {perf.assists} passe{perf.assists > 1 ? "s" : ""} D</span>}
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider mb-2">Contribution</p>
        <div className="space-y-1">
          {contrib.map((c) => (
            <div key={c.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-canal-gray-mid">
              <span className="text-sm">{c.icon}</span>
              <span className="flex-1 text-xs text-white font-bold">{c.label}</span>
              <span className="text-sm font-black text-white tabular-nums">{c.value != null ? c.value : "—"}</span>
            </div>
          ))}
          {(perf.yellowCards > 0 || perf.redCards > 0) && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-canal-gray-mid">
              <span className="text-sm">🟨</span>
              <span className="flex-1 text-xs text-white font-bold">Cartons</span>
              <span className="text-sm font-black text-white">
                {"🟨".repeat(perf.yellowCards)}{"🟥".repeat(perf.redCards)}
              </span>
            </div>
          )}
        </div>
      </div>

      {perf.timeline.length > 0 && (
        <div>
          <p className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider mb-2">Timeline</p>
          <div className="space-y-1">
            {perf.timeline.map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-canal-gray-mid">
                <span className="text-canal-yellow font-black text-sm w-10 shrink-0">{e.minute}&apos;</span>
                <span className="text-base">{e.icon}</span>
                <span className="text-xs text-white">{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vue principale ─────────────────────────────────────────────────────────
type Tab = "forme" | "mondial" | "match";

export function PlayerCardView({
  card,
  matchPerf,
  compact,
}: {
  card: PlayerCard;
  matchPerf?: MatchPerf;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(matchPerf ? "match" : "forme");
  const tabs: { key: Tab; label: string }[] = [
    ...(matchPerf ? [{ key: "match" as Tab, label: "Match" }] : []),
    { key: "forme", label: "Forme" },
    { key: "mondial", label: "Mondial" },
  ];

  return (
    <div className="space-y-4">
      <Header card={card} compact={compact} />
      <DangerCard card={card} />

      <div className="flex border-b border-canal-gray-light">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 py-2.5 text-sm font-black transition-colors",
              tab === t.key ? "text-canal-yellow border-b-2 border-canal-yellow" : "text-canal-gray-muted hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "match" && matchPerf && <MatchTab perf={matchPerf} />}
      {tab === "forme" && <FormTab card={card} />}
      {tab === "mondial" && <WorldCupTab card={card} />}
    </div>
  );
}
