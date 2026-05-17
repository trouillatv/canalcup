"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check, X, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BabyFootMatch, Team } from "@/lib/supabase/types";

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

const ROUNDS = ["Groupes", "Quarts", "Demis", "3ème place", "Finale"];
const ROUND_ICONS: Record<string, string> = {
  Groupes: "⚽", Quarts: "⚡", Demis: "🌟", "3ème place": "🥉", Finale: "🏆",
};

function headers() {
  return { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET };
}

// ─── Score editor (inline) ───────────────────────────────────────────────────

function ScoreEditor({
  match,
  onSaved,
}: {
  match: BabyFootMatch;
  onSaved: (updated: BabyFootMatch) => void;
}) {
  const [scoreA, setScoreA] = useState(match.score_a ?? 0);
  const [scoreB, setScoreB] = useState(match.score_b ?? 0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/babyfoot", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ id: match.id, score_a: scoreA, score_b: scoreB, status: "finished" }),
    });
    if (res.ok) onSaved(await res.json());
    setSaving(false);
  };

  const reset = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/babyfoot", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ id: match.id, score_a: null, score_b: null, status: "upcoming" }),
    });
    if (res.ok) onSaved(await res.json());
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={99}
        value={scoreA}
        onChange={(e) => setScoreA(Number(e.target.value))}
        className="w-12 bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1.5 text-center text-white font-black text-base"
      />
      <span className="text-canal-gray-muted font-bold">–</span>
      <input
        type="number"
        min={0}
        max={99}
        value={scoreB}
        onChange={(e) => setScoreB(Number(e.target.value))}
        className="w-12 bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1.5 text-center text-white font-black text-base"
      />
      <button
        onClick={save}
        disabled={saving}
        className="p-1.5 bg-canal-green/20 text-canal-green rounded-lg hover:bg-canal-green/30 transition-colors disabled:opacity-50"
      >
        <Check size={14} />
      </button>
      {match.status === "finished" && (
        <button
          onClick={reset}
          disabled={saving}
          className="p-1.5 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-900/30 transition-colors disabled:opacity-50"
          title="Annuler le résultat"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ─── Match row ───────────────────────────────────────────────────────────────

function MatchRow({
  match,
  onUpdate,
  onDelete,
}: {
  match: BabyFootMatch;
  onUpdate: (m: BabyFootMatch) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const winner =
    match.status === "finished" && match.score_a !== undefined && match.score_b !== undefined
      ? match.score_a > match.score_b ? "a" : match.score_a < match.score_b ? "b" : null
      : null;

  return (
    <div className={cn(
      "canal-card flex items-center gap-3",
      match.status === "finished" ? "opacity-80" : ""
    )}>
      {/* Round badge */}
      <span className="text-xs font-bold text-canal-gray-muted shrink-0 w-14 text-center">
        {ROUND_ICONS[match.round] ?? "⚽"} {match.round}
      </span>

      {/* Teams */}
      <div className={cn("flex-1 text-sm font-bold text-right truncate", winner === "b" ? "text-canal-gray-muted" : "text-white")}>
        {match.team_a?.name}
      </div>

      {/* Score / Editor */}
      <div className="shrink-0">
        {editing ? (
          <ScoreEditor
            match={match}
            onSaved={(m) => { onUpdate(m); setEditing(false); }}
          />
        ) : match.status === "finished" ? (
          <div className="flex items-center gap-2">
            <span className={cn("font-black text-base", winner === "a" ? "text-canal-yellow" : "text-white")}>{match.score_a}</span>
            <span className="text-canal-gray-muted">–</span>
            <span className={cn("font-black text-base", winner === "b" ? "text-canal-yellow" : "text-white")}>{match.score_b}</span>
            <button
              onClick={() => setEditing(true)}
              className="p-1 text-canal-gray-muted hover:text-white transition-colors ml-1"
            >
              <Edit2 size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-canal-yellow/10 border border-canal-yellow/30 text-canal-yellow text-xs font-bold rounded-lg hover:bg-canal-yellow/20 transition-colors"
          >
            <Edit2 size={11} /> Saisir score
          </button>
        )}
      </div>

      <div className={cn("flex-1 text-sm font-bold truncate", winner === "a" ? "text-canal-gray-muted" : "text-white")}>
        {match.team_b?.name}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(match.id)}
        className="p-1.5 text-canal-gray-muted hover:text-red-400 transition-colors shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Create match form ────────────────────────────────────────────────────────

function CreateMatchForm({ teams, onCreate }: { teams: Team[]; onCreate: (m: BabyFootMatch) => void }) {
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [round, setRound] = useState("Groupes");
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!teamA || !teamB) { setError("Sélectionne les deux équipes."); return; }
    if (teamA === teamB) { setError("Même équipe des deux côtés."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/babyfoot", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ team_a_id: teamA, team_b_id: teamB, round, starts_at: new Date(startsAt).toISOString() }),
    });
    if (res.ok) {
      onCreate(await res.json());
      setTeamA(""); setTeamB("");
    } else {
      const d = await res.json();
      setError(d.error ?? "Erreur serveur.");
    }
    setSaving(false);
  };

  return (
    <div className="canal-card space-y-4">
      <p className="text-canal-yellow font-bold text-sm flex items-center gap-2">
        <Plus size={14} /> Nouveau match
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-canal-gray-muted mb-1 block">Équipe A</label>
          <select
            value={teamA}
            onChange={(e) => setTeamA(e.target.value)}
            className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">— Choisir —</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-canal-gray-muted mb-1 block">Équipe B</label>
          <select
            value={teamB}
            onChange={(e) => setTeamB(e.target.value)}
            className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">— Choisir —</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-canal-gray-muted mb-1 block">Tour</label>
          <select
            value={round}
            onChange={(e) => setRound(e.target.value)}
            className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
          >
            {ROUNDS.map((r) => <option key={r} value={r}>{ROUND_ICONS[r]} {r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-canal-gray-muted mb-1 block">Date / Heure</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-50 text-sm"
      >
        {saving ? "Enregistrement…" : "Créer le match"}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminBabyFootPage() {
  const [matches, setMatches] = useState<BabyFootMatch[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [mRes, tRes] = await Promise.all([
      fetch("/api/admin/babyfoot", { headers: { "x-admin-secret": ADMIN_SECRET } }),
      fetch("/api/teams"),
    ]);
    if (mRes.ok) setMatches(await mRes.json());
    if (tRes.ok) { const d = await tRes.json(); setTeams(d.teams ?? d); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdate = (updated: BabyFootMatch) =>
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/babyfoot?id=${id}`, { method: "DELETE", headers: { "x-admin-secret": ADMIN_SECRET } });
    setMatches((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCreate = (m: BabyFootMatch) => setMatches((prev) => [...prev, m]);

  // Group by round for display
  const byRound = ROUNDS.reduce<Record<string, BabyFootMatch[]>>((acc, r) => {
    acc[r] = matches.filter((m) => m.round === r);
    return acc;
  }, {});

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="canal-headline text-2xl">Admin — Tournoi Babyfoot</h1>
        <p className="text-canal-gray-muted text-sm mt-1">{matches.length} match(s) · {matches.filter(m => m.status === "finished").length} terminé(s)</p>
      </div>

      <CreateMatchForm teams={teams} onCreate={handleCreate} />

      {loading ? (
        <p className="text-canal-gray-muted text-sm text-center py-8">Chargement…</p>
      ) : matches.length === 0 ? (
        <p className="text-canal-gray-muted text-sm text-center py-8">Aucun match. Créez le premier match ci-dessus.</p>
      ) : (
        ROUNDS.map((round) => {
          const roundMatches = byRound[round] ?? [];
          if (!roundMatches.length) return null;
          return (
            <section key={round}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{ROUND_ICONS[round] ?? "⚽"}</span>
                <h2 className="font-black text-white uppercase tracking-wide text-sm">{round}</h2>
                <span className="text-xs text-canal-gray-muted">({roundMatches.length} match{roundMatches.length > 1 ? "s" : ""})</span>
              </div>
              <div className="space-y-2">
                {roundMatches.map((m) => (
                  <MatchRow key={m.id} match={m} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
