"use client";

import { useState } from "react";
import type { LineupPlayer, PlayerMatchStat, MatchEvent } from "@/services/football/types";

// Vue « terrain » (à la SofaScore) : les titulaires placés par formation, photo
// ronde + pastille de note colorée + numéro/nom, cartons et remplacements.
// Données : lineups (grid « ligne:colonne » dans formation_position, formation
// dans role), notes via player_match_stats (jointure player_id), cartons idem,
// remplacements via match_events.

interface Props {
  lineups: {
    home: LineupPlayer[];
    away: LineupPlayer[];
    home_formation?: string;
    away_formation?: string;
  };
  playerStats: PlayerMatchStat[];
  events: MatchEvent[];
  teamA: string;
  teamB: string;
  onPlayerClick?: (playerId: string, name: string) => void;
}

function ratingColor(r: number | null): string {
  if (r == null) return "bg-canal-gray-light text-canal-gray-muted";
  if (r >= 7.5) return "bg-green-600 text-white";
  if (r >= 6.5) return "bg-canal-yellow text-canal-black";
  if (r >= 5) return "bg-orange-500 text-white";
  return "bg-red-600 text-white";
}

function photoUrl(playerId?: string): string | null {
  return playerId ? `https://media.api-sports.io/football/players/${playerId}.png` : null;
}

// "ligne:colonne" → { row, col }. row 1 = gardien, croît vers l'attaque.
function parseGrid(g?: string): { row: number; col: number } | null {
  if (!g) return null;
  const [r, c] = g.split(":").map((n) => parseInt(n, 10));
  if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
  return { row: r, col: c };
}

// Ligne d'un joueur d'après son poste (G/D/M/F ou Gardien/Défenseur/…).
function posRow(pos: string): number {
  const s = (pos || "").trim().toUpperCase();
  if (s.startsWith("G")) return 0; // gardien
  if (s.startsWith("D")) return 1; // défenseur
  if (s.startsWith("M")) return 2; // milieu
  return 3; // attaquant (F / A / …)
}

// Regroupe les titulaires en lignes. Priorité au grid « ligne:colonne » (vrai
// placement) ; sinon repli robuste sur le POSTE (G/D/M/F) — garantit que les 11
// s'affichent même sans grid ni formation valide (données seedées/anciennes).
function toRows(players: LineupPlayer[]): LineupPlayer[][] {
  const starters = players.filter((p) => p.is_starting);
  if (!starters.length) return [];
  const gridCount = starters.filter((p) => parseGrid(p.formation_position)).length;

  if (gridCount >= Math.ceil(starters.length * 0.7)) {
    const byRow = new Map<number, LineupPlayer[]>();
    for (const p of starters) {
      const g = parseGrid(p.formation_position);
      const row = g?.row ?? posRow(p.position) + 1; // joueur sans grid → par poste
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row)!.push(p);
    }
    return [...byRow.keys()]
      .sort((a, b) => a - b)
      .map((row) =>
        byRow.get(row)!.sort(
          (a, b) => (parseGrid(a.formation_position)?.col ?? 99) - (parseGrid(b.formation_position)?.col ?? 99)
        )
      );
  }

  // Repli par poste : 4 lignes (GK / DEF / MID / FWD), vides retirées.
  const buckets: LineupPlayer[][] = [[], [], [], []];
  for (const p of starters) buckets[posRow(p.position)].push(p);
  return buckets.filter((b) => b.length);
}

function PlayerDot({
  player,
  stat,
  subbedOff,
  mirror,
  onPlayerClick,
}: {
  player: LineupPlayer;
  stat?: PlayerMatchStat;
  subbedOff: boolean;
  mirror: boolean;
  onPlayerClick?: (playerId: string, name: string) => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const pid = player.player_id ?? stat?.player_id;
  const url = photoUrl(pid);
  const rating = stat?.rating ?? null;
  const yellow = (stat?.yellow_cards ?? 0) > 0;
  const red = (stat?.red_cards ?? 0) > 0;
  const motm = stat?.is_motm ?? false;
  const last = player.player_name.split(" ").slice(-1).join(" ");
  const clickable = !!(onPlayerClick && pid);

  return (
    <div className="flex flex-col items-center gap-1 w-[58px]" style={mirror ? { transform: "scaleY(-1)" } : undefined}>
      <div
        style={mirror ? { transform: "scaleY(-1)" } : undefined}
        className={`flex flex-col items-center gap-1 ${clickable ? "cursor-pointer" : ""}`}
        onClick={clickable ? () => onPlayerClick!(pid!, player.player_name) : undefined}
      >
        <div className="relative">
          <div className="w-11 h-11 rounded-full bg-canal-gray-mid border-2 border-white/80 overflow-hidden flex items-center justify-center shadow-md">
            {url && imgOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={last} className="w-full h-full object-cover" onError={() => setImgOk(false)} />
            ) : (
              <span className="text-white font-black text-sm">{player.shirt_number || "?"}</span>
            )}
          </div>

          {/* Note */}
          {rating != null && (
            <span
              className={`absolute -bottom-1 -right-1 min-w-[20px] px-1 h-[18px] rounded-md text-[10px] font-black flex items-center justify-center shadow ${ratingColor(rating)}`}
            >
              {rating.toFixed(1)}
            </span>
          )}

          {/* Cartons */}
          {(yellow || red) && (
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-3.5 rounded-[2px] shadow ${red ? "bg-red-600" : "bg-yellow-400"}`}
            />
          )}

          {/* Remplacé */}
          {subbedOff && (
            <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-canal-black/80 flex items-center justify-center text-[8px] text-red-400 font-black">↓</span>
          )}

          {motm && (
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px]">⭐</span>
          )}
        </div>

        <span className="text-[9px] leading-tight text-white font-bold text-center truncate max-w-[58px] drop-shadow">
          {player.shirt_number ? `${player.shirt_number} ` : ""}{last}
        </span>
      </div>
    </div>
  );
}

function HalfPitch({
  players,
  stats,
  subbedOffIds,
  mirror,
  onPlayerClick,
}: {
  players: LineupPlayer[];
  stats: Map<string, PlayerMatchStat>;
  subbedOffIds: Set<string>;
  mirror: boolean;
  onPlayerClick?: (playerId: string, name: string) => void;
}) {
  const rows = toRows(players);
  // mirror = équipe du bas : on inverse l'ordre des lignes (gardien en bas).
  const ordered = mirror ? [...rows].reverse() : rows;

  const statFor = (p: LineupPlayer) =>
    (p.player_id && stats.get(p.player_id)) ||
    [...stats.values()].find((s) => s.player_name === p.player_name);

  return (
    <div className="flex-1 flex flex-col justify-around py-2">
      {ordered.map((row, i) => (
        <div key={i} className="flex justify-around items-center px-2">
          {row.map((p, j) =>
            p ? (
              <PlayerDot
                key={p.player_id ?? `${p.player_name}-${j}`}
                player={p}
                stat={statFor(p)}
                subbedOff={!!p.player_id && subbedOffIds.has(p.player_id)}
                mirror={mirror}
                onPlayerClick={onPlayerClick}
              />
            ) : null
          )}
        </div>
      ))}
    </div>
  );
}

export function PitchLineup({ lineups, playerStats, events, teamA, teamB, onPlayerClick }: Props) {
  if (!lineups?.home?.some((p) => p.is_starting)) {
    return (
      <p className="text-center text-canal-gray-muted text-sm py-12">
        Compositions sur le terrain disponibles dès que les équipes officielles sont publiées (~40 min avant le coup d&apos;envoi).
      </p>
    );
  }

  const statBySide = (side: "home" | "away") => {
    const m = new Map<string, PlayerMatchStat>();
    for (const s of playerStats) if (s.team_side === side) m.set(s.player_id ?? `name:${s.player_name}`, s);
    return m;
  };

  // Joueurs remplacés (sortis) : on tente par nom dans les events substitution.
  const subbedOff = (side: "home" | "away") => {
    const ids = new Set<string>();
    const sidePlayers = (side === "home" ? lineups.home : lineups.away);
    for (const e of events) {
      if (e.type !== "substitution" || e.team_side !== side) continue;
      // "Sortant → Entrant" ou nom du sortant dans player_name
      const outName = (e.player_name ?? "").split("→")[0].trim().toLowerCase();
      const p = sidePlayers.find((pl) => pl.player_name.toLowerCase() === outName);
      if (p?.player_id) ids.add(p.player_id);
    }
    return ids;
  };

  return (
    <div className="py-2">
      <div className="flex items-center justify-between text-xs mb-2 px-1">
        <span className="font-black text-white">{teamA} <span className="text-canal-yellow">{lineups.home_formation ?? ""}</span></span>
        <span className="font-black text-white">{lineups.away_formation ?? ""} {teamB}</span>
      </div>

      {/* Terrain */}
      <div
        className="relative rounded-2xl overflow-hidden border border-white/10 flex flex-col"
        style={{
          minHeight: 560,
          background:
            "repeating-linear-gradient(0deg, #15803d 0px, #15803d 56px, #166e36 56px, #166e36 112px)",
        }}
      >
        {/* Lignes du terrain */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/40" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white/40" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-16 border border-white/30 border-t-0" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-16 border border-white/30 border-b-0" />
        </div>

        <HalfPitch players={lineups.home} stats={statBySide("home")} subbedOffIds={subbedOff("home")} mirror={false} onPlayerClick={onPlayerClick} />
        <HalfPitch players={lineups.away} stats={statBySide("away")} subbedOffIds={subbedOff("away")} mirror={true} onPlayerClick={onPlayerClick} />
      </div>

      <p className="text-[10px] text-canal-gray-muted text-center mt-2">
        Note colorée = note du match · 🟨/🟥 carton · ↓ remplacé · ⭐ homme du match
      </p>
    </div>
  );
}
