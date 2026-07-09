"use client";

// Tableau (bracket) de la phase finale du Tournoi Baby-foot :
// les 2 demi-finales se rejoignent sur la Finale, avec la Petite finale
// (3ᵉ place) juste en dessous. Rendu responsive : les demies à gauche,
// la finale à droite, reliées par des connecteurs SVG qui s'étirent en hauteur.

import { cn } from "@/lib/utils";

export interface BracketMatch {
  id: string;
  labelA: string;
  labelB: string;
  score_a: number | null;
  score_b: number | null;
  status: string;
  table_no: number | null;
  starts_at: string | null;
}

function winnerOf(m?: BracketMatch): "a" | "b" | null {
  if (!m || m.status !== "finished" || m.score_a == null || m.score_b == null) return null;
  return m.score_a > m.score_b ? "a" : m.score_b > m.score_a ? "b" : null;
}

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Pacific/Noumea" });
}

function Row({ name, score, win, dim, finished }: { name: string; score: number | null; win: boolean; dim: boolean; finished: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5">
      <span className={cn("flex-1 truncate text-sm font-bold", win ? "text-canal-yellow" : dim ? "text-canal-gray-muted" : "text-white")}>
        {name}
      </span>
      {finished ? (
        <span className={cn("shrink-0 w-5 text-center font-black tabular-nums", win ? "text-canal-yellow" : "text-canal-gray-muted")}>
          {score}
        </span>
      ) : (
        <span className="shrink-0 w-5 text-center text-canal-gray-muted text-xs">–</span>
      )}
    </div>
  );
}

function Slot({
  m,
  placeholderA,
  placeholderB,
  highlightWinner,
  crown,
}: {
  m?: BracketMatch;
  placeholderA: string;
  placeholderB: string;
  highlightWinner?: boolean;
  crown?: boolean;
}) {
  const w = winnerOf(m);
  const finished = m?.status === "finished";
  const nameA = m?.labelA ?? placeholderA;
  const nameB = m?.labelB ?? placeholderB;
  const winnerName = w === "a" ? nameA : w === "b" ? nameB : null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1 px-0.5 h-4">
        {m?.table_no != null && (
          <span className="text-[9px] font-black text-canal-black bg-canal-yellow rounded px-1 leading-4">T{m.table_no}</span>
        )}
        {!finished && m?.starts_at && (
          <span className="text-[10px] text-canal-gray-muted ml-auto">{timeLabel(m.starts_at)}</span>
        )}
        {finished && <span className="text-[9px] text-canal-gray-muted ml-auto uppercase font-bold">Terminé</span>}
      </div>
      <div className={cn(
        "canal-card p-0 overflow-hidden divide-y divide-canal-gray-light/40",
        highlightWinner && winnerName ? "border-canal-yellow/50" : "border-canal-gray-light/60",
      )}>
        <Row name={nameA} score={m?.score_a ?? null} win={w === "a"} dim={w === "b"} finished={!!finished} />
        <Row name={nameB} score={m?.score_b ?? null} win={w === "b"} dim={w === "a"} finished={!!finished} />
      </div>
      {crown && winnerName && (
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-canal-yellow">
          <span className="text-base">🏆</span>
          <span className="font-black text-sm truncate">{winnerName}</span>
        </div>
      )}
    </div>
  );
}

// Connecteur SVG : 2 traits horizontaux (25 % / 75 %) reliés par un trait
// vertical, puis un trait horizontal central vers la finale. preserveAspectRatio
// "none" + non-scaling-stroke → s'étire proprement quelle que soit la hauteur.
function Connector() {
  return (
    <div className="self-stretch w-6 sm:w-8 shrink-0 text-canal-gray-light">
      <svg className="w-full h-full" viewBox="0 0 32 100" preserveAspectRatio="none">
        <g stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" fill="none">
          <line x1="0" y1="25" x2="16" y2="25" />
          <line x1="0" y1="75" x2="16" y2="75" />
          <line x1="16" y1="25" x2="16" y2="75" />
          <line x1="16" y1="50" x2="32" y2="50" />
        </g>
      </svg>
    </div>
  );
}

export function FinalBracket({
  semis,
  final,
  third,
}: {
  semis: BracketMatch[];
  final?: BracketMatch;
  third?: BracketMatch;
}) {
  const semi1 = semis[0];
  const semi2 = semis[1];

  return (
    <div className="space-y-4">
      {/* Bracket demies → finale */}
      <div className="flex items-stretch">
        {/* Colonne demi-finales */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 flex items-center py-1.5">
            <Slot m={semi1} placeholderA="1ᵉ" placeholderB="4ᵉ" />
          </div>
          <div className="flex-1 flex items-center py-1.5">
            <Slot m={semi2} placeholderA="2ᵉ" placeholderB="3ᵉ" />
          </div>
        </div>

        <Connector />

        {/* Colonne finale */}
        <div className="flex flex-col justify-center flex-1 min-w-0">
          <Slot m={final} placeholderA="Vainqueur ½ 1" placeholderB="Vainqueur ½ 2" highlightWinner crown />
        </div>
      </div>

      {/* Petite finale (3ᵉ place) */}
      <div>
        <p className="text-[11px] font-bold text-canal-gray-muted uppercase mb-1.5 flex items-center gap-1.5">
          <span>🥉</span> Petite finale · 3ᵉ place
        </p>
        <div className="max-w-xs">
          <Slot m={third} placeholderA="Perdant ½ 1" placeholderB="Perdant ½ 2" />
        </div>
      </div>
    </div>
  );
}
