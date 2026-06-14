"use client";

// Heatmap des pronostics — "comprendre en 2 secondes". Une case = un match
// pronostiqué, couleur selon l'issue (même logique que calculatePoints via
// getPredictionOutcome). Mode "player" (une ligne de cases) ou "team" (une
// ligne par membre). Mobile : scroll horizontal. Clic sur une case → détail.

import { useState } from "react";
import type { PredictionOutcome } from "@/lib/scoring";

export interface HeatItem {
  id: string;
  outcome: PredictionOutcome;
  predicted: string;       // "2–1"
  actual: string | null;   // "1–1" ou null si pas joué
  label: string;           // "France – Brésil"
  created_at?: string;
}
export interface HeatRow {
  name: string;
  items: HeatItem[];
}

interface Props {
  mode: "player" | "team";
  items?: HeatItem[];   // mode player
  rows?: HeatRow[];     // mode team
  compact?: boolean;
}

const STYLE: Record<PredictionOutcome, { cls: string; emoji: string; label: string }> = {
  exact:          { cls: "bg-canal-yellow text-canal-black", emoji: "🎯", label: "Score exact" },
  correct_result: { cls: "bg-green-500 text-black",          emoji: "✅", label: "Bon résultat" },
  correct_diff:   { cls: "bg-amber-500 text-black",          emoji: "🟡", label: "Bonne diff." },
  wrong:          { cls: "bg-red-500/80 text-white",         emoji: "❌", label: "Raté" },
  pending:        { cls: "bg-canal-gray-light/40 text-canal-gray-muted", emoji: "·", label: "À venir" },
};

function Cell({ it, size, onClick, active }: { it: HeatItem; size: string; onClick: () => void; active: boolean }) {
  const s = STYLE[it.outcome];
  return (
    <button
      onClick={onClick}
      title={`${it.label} — pronostic ${it.predicted}${it.actual ? ` / réel ${it.actual}` : " (à venir)"}`}
      className={`${size} ${s.cls} rounded-[5px] flex items-center justify-center text-[11px] font-bold shrink-0 transition-transform ${active ? "ring-2 ring-white scale-110" : "hover:scale-105"}`}
    >
      {it.outcome === "pending" ? "" : s.emoji}
    </button>
  );
}

export function PredictionHeatmap({ mode, items = [], rows = [], compact }: Props) {
  const [sel, setSel] = useState<HeatItem | null>(null);
  const size = compact ? "w-5 h-5" : "w-7 h-7";

  const empty = mode === "player" ? items.length === 0 : rows.every((r) => r.items.length === 0);
  if (empty) {
    return <p className="text-xs text-canal-gray-muted">Aucun pronostic à afficher pour l&apos;instant.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Légende */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-canal-gray-muted">
        {(["exact", "correct_result", "wrong", "pending"] as PredictionOutcome[]).map((o) => (
          <span key={o} className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded-[3px] ${STYLE[o].cls}`} /> {STYLE[o].emoji} {STYLE[o].label}
          </span>
        ))}
      </div>

      {/* Grille */}
      {mode === "player" ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <Cell key={it.id} it={it} size={size} active={sel?.id === it.id} onClick={() => setSel(it)} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="space-y-1.5 min-w-min">
            {rows.map((row) => (
              <div key={row.name} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-white truncate">{row.name}</span>
                <div className="flex gap-1.5">
                  {row.items.length === 0 ? (
                    <span className="text-[11px] text-canal-gray-muted">—</span>
                  ) : (
                    row.items.map((it) => (
                      <Cell key={it.id} it={it} size={size} active={sel?.id === it.id} onClick={() => setSel(it)} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Détail au clic */}
      {sel && (
        <div className="bg-canal-gray-mid rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2">
          <span className="text-white truncate">
            {STYLE[sel.outcome].emoji} {sel.label}
          </span>
          <span className="text-canal-gray-muted shrink-0">
            prono <span className="text-white font-bold">{sel.actual ? sel.predicted : "saisi"}</span>
            {sel.actual && <> · réel <span className="text-white font-bold">{sel.actual}</span></>}
          </span>
        </div>
      )}
    </div>
  );
}
