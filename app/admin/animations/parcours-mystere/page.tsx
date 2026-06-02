"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MysteryPlayer {
  id: string;
  name: string;
  difficulty: "easy" | "medium" | "hard";
}

interface Team {
  id: string;
  name: string;
}

interface ScoreEvent {
  id: string;
  label: string;
  raw_points: number;
  created_at: string;
}

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";
const POINTS_OPTIONS = [10, 7, 5, 3];
const DIFF_LABEL: Record<string, string> = { easy: "Facile", medium: "Moyen", hard: "Difficile" };
const DIFF_CLS: Record<string, string> = {
  easy: "text-canal-green bg-canal-green/15",
  medium: "text-canal-yellow bg-canal-yellow/10",
  hard: "text-red-400 bg-red-900/20",
};

function headers() {
  return { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET };
}

export default function AdminParcoursMysterePage() {
  const [players, setPlayers] = useState<MysteryPlayer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [history, setHistory] = useState<ScoreEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlayer, setSelectedPlayer] = useState<MysteryPlayer | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedPts, setSelectedPts] = useState<number>(10);
  const [saving, setSaving] = useState(false);
  const [lastMsg, setLastMsg] = useState("");

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/parcours-mystere", { headers: { "x-admin-secret": ADMIN_SECRET } });
    if (res.ok) {
      const d = await res.json();
      setPlayers(d.players ?? []);
      setTeams(d.teams ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const awardPoints = async () => {
    if (!selectedTeam || !selectedPts) return;
    setSaving(true);
    setLastMsg("");
    const label = selectedPlayer
      ? `Parcours Mystère — ${selectedPlayer.name} (indice ${POINTS_OPTIONS.indexOf(selectedPts) + 1})`
      : `Parcours Mystère (${selectedPts} pts)`;
    const res = await fetch("/api/admin/parcours-mystere", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ team_id: selectedTeam.id, raw_points: selectedPts, label }),
    });
    if (res.ok) {
      const ev: ScoreEvent = await res.json();
      setHistory((h) => [ev, ...h]);
      setLastMsg(`✅ ${selectedPts} pts attribués à ${selectedTeam.name}`);
    } else {
      setLastMsg("❌ Erreur lors de l'attribution.");
    }
    setSaving(false);
  };

  return (
    <div className="px-4 py-6 max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="canal-headline text-2xl">Parcours Mystère — Admin</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Attribue les points à l&apos;équipe gagnante après chaque question.
          L&apos;écran de jeu est sur{" "}
          <a href="/animations/parcours-mystere" target="_blank" className="text-canal-yellow underline">
            /animations/parcours-mystere
          </a>
        </p>
      </div>

      {loading ? (
        <p className="text-canal-gray-muted text-sm text-center py-8 animate-pulse">Chargement…</p>
      ) : (
        <>
          {/* ── Joueur joué (contexte, optionnel) ── */}
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider">
              Joueur de la question (optionnel)
            </h2>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)}
                  className={cn(
                    "canal-card text-left transition-colors py-2 px-3",
                    selectedPlayer?.id === p.id
                      ? "border-canal-yellow/60 bg-canal-yellow/5"
                      : "hover:border-canal-gray-light"
                  )}
                >
                  <p className="font-bold text-white text-sm truncate">{p.name}</p>
                  <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full", DIFF_CLS[p.difficulty])}>
                    {DIFF_LABEL[p.difficulty]}
                  </span>
                </button>
              ))}
            </div>
            {selectedPlayer && (
              <p className="text-canal-yellow text-xs font-bold">✓ {selectedPlayer.name} sélectionné</p>
            )}
          </section>

          {/* ── Équipe ── */}
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider">Équipe gagnante</h2>
            <div className="grid grid-cols-2 gap-2">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeam(selectedTeam?.id === t.id ? null : t)}
                  className={cn(
                    "canal-card py-3 text-center font-black transition-colors",
                    selectedTeam?.id === t.id
                      ? "border-canal-yellow bg-canal-yellow/10 text-canal-yellow"
                      : "text-white hover:border-canal-gray-light"
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </section>

          {/* ── Points ── */}
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider">Points</h2>
            <div className="grid grid-cols-4 gap-2">
              {POINTS_OPTIONS.map((pts, idx) => (
                <button
                  key={pts}
                  onClick={() => setSelectedPts(pts)}
                  className={cn(
                    "canal-card py-3 text-center transition-colors",
                    selectedPts === pts
                      ? "border-canal-yellow bg-canal-yellow/10"
                      : "hover:border-canal-gray-light"
                  )}
                >
                  <p className={cn("font-black text-2xl", selectedPts === pts ? "text-canal-yellow" : "text-white")}>
                    {pts}
                  </p>
                  <p className="text-[10px] text-canal-gray-muted">indice {idx + 1}</p>
                </button>
              ))}
            </div>
          </section>

          {/* ── Bouton ── */}
          <button
            onClick={awardPoints}
            disabled={saving || !selectedTeam}
            className="w-full py-3 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Trophy size={16} />
            {saving ? "Attribution…" : `Attribuer ${selectedPts} pts${selectedTeam ? ` à ${selectedTeam.name}` : ""}`}
          </button>

          {lastMsg && (
            <p className={cn("text-sm font-bold text-center", lastMsg.startsWith("✅") ? "text-canal-green" : "text-red-400")}>
              {lastMsg}
            </p>
          )}

          {/* ── Historique session ── */}
          {history.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider">
                Points attribués cette session
              </h2>
              <div className="space-y-1.5">
                {history.map((ev) => (
                  <div key={ev.id} className="canal-card flex items-center gap-3 py-2">
                    <Check size={14} className="text-canal-green shrink-0" />
                    <p className="flex-1 text-sm text-white truncate">{ev.label}</p>
                    <span className="font-black text-canal-yellow shrink-0">{ev.raw_points} pts</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
