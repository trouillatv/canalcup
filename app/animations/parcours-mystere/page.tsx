"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, ChevronRight, RotateCcw, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface MysteryPlayer {
  id: string;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  hint_1: string;
  hint_2: string | null;
  hint_3: string | null;
  hint_4: string | null;
  explanation: string | null;
  sort_order: number;
}

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

const DIFFICULTY_META = {
  easy:   { label: "Facile",   color: "text-canal-green  bg-canal-green/15  border-canal-green/30",  dot: "bg-canal-green"  },
  medium: { label: "Moyen",    color: "text-canal-yellow bg-canal-yellow/10 border-canal-yellow/30", dot: "bg-canal-yellow" },
  hard:   { label: "Difficile", color: "text-red-400     bg-red-900/20       border-red-500/30",      dot: "bg-red-400"      },
};

const POINTS_BY_HINT: Record<number, number> = { 1: 10, 2: 7, 3: 5, 4: 3 };

// ─── Écran de jeu ─────────────────────────────────────────────────────────────

function GameScreen({
  player,
  onReset,
}: {
  player: MysteryPlayer;
  onReset: () => void;
}) {
  const hints = [player.hint_1, player.hint_2, player.hint_3, player.hint_4].filter(Boolean) as string[];
  const [revealed, setRevealed] = useState(1);
  const [showAnswer, setShowAnswer] = useState(false);
  const meta = DIFFICULTY_META[player.difficulty];

  const revealNext = () => setRevealed((r) => Math.min(r + 1, hints.length));
  const canRevealMore = revealed < hints.length;

  return (
    <div className="min-h-screen bg-canal-black flex flex-col items-center justify-center p-6 gap-8">
      {/* Header */}
      <div className="flex items-center gap-4 w-full max-w-3xl justify-between">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-canal-gray-muted hover:text-white text-sm transition-colors"
        >
          <RotateCcw size={14} /> Changer de joueur
        </button>
        <span className={cn("text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border", meta.color)}>
          {meta.label}
        </span>
      </div>

      {/* Titre */}
      <div className="text-center">
        <p className="text-canal-gray-muted text-sm font-bold uppercase tracking-widest mb-2">Parcours Mystère</p>
        <h1 className="canal-headline text-4xl md:text-6xl">Qui est ce joueur&nbsp;?</h1>
      </div>

      {/* Indices */}
      <div className="w-full max-w-3xl space-y-3">
        {hints.map((hint, idx) => {
          const num = idx + 1;
          const isVisible = num <= revealed;
          const pts = POINTS_BY_HINT[num];
          return (
            <div
              key={num}
              className={cn(
                "canal-card transition-all duration-300",
                isVisible ? "opacity-100" : "opacity-30"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-canal-black font-black text-sm", meta.dot)}>
                  {num}
                </div>
                <div className="flex-1">
                  {isVisible ? (
                    <p className="text-white text-lg md:text-xl font-bold leading-snug">{hint}</p>
                  ) : (
                    <div className="h-6 w-64 bg-canal-gray-mid rounded-lg" />
                  )}
                </div>
                <span className={cn(
                  "shrink-0 text-xs font-black px-2 py-1 rounded-lg",
                  isVisible ? "text-canal-yellow bg-canal-yellow/10" : "text-canal-gray-muted bg-canal-gray-mid"
                )}>
                  {pts} pts
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Réponse */}
      {showAnswer && (
        <div className="w-full max-w-3xl canal-card border-canal-yellow/40 bg-canal-yellow/5 text-center space-y-2">
          <p className="text-canal-gray-muted text-xs font-bold uppercase tracking-widest">Réponse</p>
          <p className="canal-headline text-3xl md:text-5xl text-canal-yellow">{player.name}</p>
          {player.explanation && (
            <p className="text-canal-gray-muted text-sm mt-2">{player.explanation}</p>
          )}
        </div>
      )}

      {/* Boutons */}
      <div className="flex flex-wrap gap-3 justify-center">
        {canRevealMore && !showAnswer && (
          <button
            onClick={revealNext}
            className="flex items-center gap-2 px-6 py-3 bg-canal-gray-mid border border-canal-gray-light text-white font-bold rounded-xl hover:border-canal-yellow/50 hover:text-canal-yellow transition-colors text-sm"
          >
            <Eye size={16} /> Indice {revealed + 1}
            <span className="text-canal-yellow ml-1">({POINTS_BY_HINT[revealed + 1]} pts)</span>
          </button>
        )}
        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="flex items-center gap-2 px-6 py-3 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors text-sm"
          >
            <Eye size={16} /> Révéler la réponse
          </button>
        ) : (
          <button
            onClick={() => { setRevealed(1); setShowAnswer(false); onReset(); }}
            className="flex items-center gap-2 px-6 py-3 bg-canal-gray-mid border border-canal-gray-light text-white font-bold rounded-xl hover:border-canal-yellow/50 transition-colors text-sm"
          >
            <RotateCcw size={16} /> Nouvelle question
          </button>
        )}
      </div>

      {/* Rappel attribution */}
      {!showAnswer && (
        <p className="text-canal-gray-muted text-xs text-center">
          L&apos;animateur attribue les points via <span className="text-canal-yellow">/admin/animations/parcours-mystere</span>
        </p>
      )}
    </div>
  );
}

// ─── Sélecteur de joueur ──────────────────────────────────────────────────────

function PlayerPicker({
  players,
  onSelect,
}: {
  players: MysteryPlayer[];
  onSelect: (p: MysteryPlayer) => void;
}) {
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "all">("all");

  const filtered = difficulty === "all" ? players : players.filter((p) => p.difficulty === difficulty);

  return (
    <div className="min-h-screen bg-canal-black p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <p className="text-canal-gray-muted text-xs font-bold uppercase tracking-widest mb-1">Animation</p>
        <h1 className="canal-headline text-3xl">Parcours Mystère</h1>
        <p className="text-canal-gray-muted text-sm mt-1">Choisissez un joueur pour lancer la session.</p>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "easy", "medium", "hard"] as const).map((d) => {
          const label = d === "all" ? "Tous" : DIFFICULTY_META[d].label;
          return (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors",
                difficulty === d
                  ? d === "all"
                    ? "bg-white text-canal-black border-white"
                    : cn(DIFFICULTY_META[d].color, "border-current")
                  : "bg-canal-gray-mid border-canal-gray-light text-canal-gray-muted hover:text-white"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Grille */}
      <div className="space-y-2">
        {filtered.map((p) => {
          const meta = DIFFICULTY_META[p.difficulty];
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full canal-card hover:border-canal-yellow/40 transition-colors text-left flex items-center gap-3"
            >
              <div className={cn("w-2 h-2 rounded-full shrink-0", meta.dot)} />
              <div className="flex-1 min-w-0">
                <p className="font-black text-white">{p.name}</p>
                <p className="text-xs text-canal-gray-muted truncate">{p.hint_1}</p>
              </div>
              <ChevronRight size={16} className="text-canal-gray-muted shrink-0" />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-canal-gray-muted text-sm text-center py-6">Aucun joueur pour ce niveau.</p>
        )}
      </div>

      <div className="canal-card border-canal-yellow/20 bg-canal-yellow/5">
        <p className="text-canal-yellow text-xs font-bold flex items-center gap-1.5 mb-1">
          <Star size={12} /> Barème
        </p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {Object.entries(POINTS_BY_HINT).map(([hint, pts]) => (
            <div key={hint} className="text-xs">
              <p className="text-canal-yellow font-black text-lg">{pts}</p>
              <p className="text-canal-gray-muted">indice {hint}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ParcoursMysterePage() {
  const [players, setPlayers] = useState<MysteryPlayer[]>([]);
  const [selected, setSelected] = useState<MysteryPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/parcours-mystere", { headers: { "x-admin-secret": ADMIN_SECRET } })
      .then((r) => r.json())
      .then((d) => { setPlayers(d.players ?? []); setLoading(false); })
      .catch(() => { setError("Impossible de charger les joueurs."); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-canal-black flex items-center justify-center">
        <p className="text-canal-gray-muted animate-pulse">Chargement…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-canal-black flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }
  if (selected) {
    return <GameScreen player={selected} onReset={() => setSelected(null)} />;
  }
  return <PlayerPicker players={players} onSelect={setSelected} />;
}
