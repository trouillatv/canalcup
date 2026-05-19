"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check, EyeOff, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Challenge, ChallengeEntry, ChallengeStatus, Team } from "@/lib/supabase/types";

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

function headers() {
  return { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET };
}

const CHALLENGE_STATUSES: ChallengeStatus[] = ["upcoming", "live", "finished", "hidden"];
const STATUS_LABEL: Record<ChallengeStatus, string> = {
  upcoming: "À venir", live: "En cours", finished: "Terminé", hidden: "Masqué",
};
const ENTRY_STATUS_CLS: Record<string, string> = {
  approved: "text-canal-green bg-canal-green/15",
  pending: "text-canal-yellow bg-canal-yellow/10",
  hidden: "text-canal-gray-muted bg-canal-gray-mid",
};

// ─── Éditeur de points (inline) ──────────────────────────────────────────────

function EntryRow({
  entry, maxPoints, onChange, onDelete,
}: {
  entry: ChallengeEntry;
  maxPoints: number;
  onChange: (e: ChallengeEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [pts, setPts] = useState(entry.points_awarded ?? 0);
  const [saving, setSaving] = useState(false);

  const patch = async (payload: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch("/api/admin/challenges", {
      method: "PATCH", headers: headers(),
      body: JSON.stringify({ entry_id: entry.id, ...payload }),
    });
    if (res.ok) onChange(await res.json());
    setSaving(false);
  };

  return (
    <div className="canal-card flex flex-wrap items-center gap-3 py-3">
      <div className="flex-1 min-w-[140px]">
        <p className="font-bold text-white text-sm">{entry.team?.name ?? "Équipe"}</p>
        {entry.title && <p className="text-xs text-canal-gray-muted">{entry.title}</p>}
        <span className={cn("inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", ENTRY_STATUS_CLS[entry.status])}>
          {entry.status === "approved" ? "Validé" : entry.status === "pending" ? "En attente" : "Masqué"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number" min={0} max={maxPoints || 0} value={pts}
          onChange={(e) => setPts(Number(e.target.value))}
          className="w-16 bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1.5 text-center text-white font-black text-sm"
        />
        <span className="text-xs text-canal-gray-muted">/ {maxPoints}</span>
        <button
          onClick={() => patch({ points_awarded: pts })}
          disabled={saving}
          title="Attribuer les points (→ score_events)"
          className="p-1.5 bg-canal-yellow/15 text-canal-yellow rounded-lg hover:bg-canal-yellow/25 transition-colors disabled:opacity-50"
        >
          <Trophy size={14} />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {entry.status !== "approved" && (
          <button
            onClick={() => patch({ status: "approved" })}
            disabled={saving}
            title="Valider"
            className="p-1.5 bg-canal-green/15 text-canal-green rounded-lg hover:bg-canal-green/25 transition-colors disabled:opacity-50"
          >
            <Check size={14} />
          </button>
        )}
        {entry.status !== "hidden" && (
          <button
            onClick={() => patch({ status: "hidden" })}
            disabled={saving}
            title="Masquer (retire les points)"
            className="p-1.5 bg-canal-gray-mid text-canal-gray-muted rounded-lg hover:text-white transition-colors disabled:opacity-50"
          >
            <EyeOff size={14} />
          </button>
        )}
        <button
          onClick={() => onDelete(entry.id)}
          className="p-1.5 text-canal-gray-muted hover:text-red-400 transition-colors"
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Formulaire participation manuelle ───────────────────────────────────────

function CreateEntryForm({
  challenges, teams, onCreate,
}: {
  challenges: Challenge[];
  teams: Team[];
  onCreate: (e: ChallengeEntry) => void;
}) {
  const [challengeId, setChallengeId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!challengeId || !teamId) { setError("Choisis une activité et une équipe."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/admin/challenges", {
      method: "POST", headers: headers(),
      body: JSON.stringify({ challenge_id: challengeId, team_id: teamId, title: title || null }),
    });
    if (res.ok) {
      onCreate(await res.json());
      setTitle("");
    } else {
      setError((await res.json()).error ?? "Erreur serveur.");
    }
    setSaving(false);
  };

  return (
    <div className="canal-card space-y-3">
      <p className="text-canal-yellow font-bold text-sm flex items-center gap-2">
        <Plus size={14} /> Participation manuelle
      </p>
      <div className="grid grid-cols-2 gap-3">
        <select
          value={challengeId} onChange={(e) => setChallengeId(e.target.value)}
          className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">— Activité —</option>
          {challenges.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>)}
        </select>
        <select
          value={teamId} onChange={(e) => setTeamId(e.target.value)}
          className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">— Équipe —</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <input
        value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Note / réponse (optionnel)"
        className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={save} disabled={saving}
        className="w-full py-2.5 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-50 text-sm"
      >
        {saving ? "Enregistrement…" : "Ajouter la participation"}
      </button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [cRes, tRes] = await Promise.all([
      fetch("/api/admin/challenges", { headers: { "x-admin-secret": ADMIN_SECRET } }),
      fetch("/api/teams"),
    ]);
    if (cRes.ok) {
      const d = await cRes.json();
      setChallenges(d.challenges ?? []);
      setEntries(d.entries ?? []);
    }
    if (tRes.ok) { const d = await tRes.json(); setTeams(d.teams ?? d); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEntryChange = (u: ChallengeEntry) =>
    setEntries((prev) => prev.map((e) => (e.id === u.id ? u : e)));

  const handleEntryCreate = (e: ChallengeEntry) => setEntries((prev) => [e, ...prev]);

  const handleEntryDelete = async (id: string) => {
    await fetch(`/api/admin/challenges?id=${id}`, {
      method: "DELETE", headers: { "x-admin-secret": ADMIN_SECRET },
    });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const setChallengeStatus = async (challenge: Challenge, status: ChallengeStatus) => {
    const res = await fetch("/api/admin/challenges", {
      method: "PATCH", headers: headers(),
      body: JSON.stringify({ challenge_id: challenge.id, status }),
    });
    if (res.ok) {
      const u = await res.json();
      setChallenges((prev) => prev.map((c) => (c.id === u.id ? u : c)));
    }
  };

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="canal-headline text-2xl">Admin — Animations</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          {challenges.length} activité(s) · {entries.length} participation(s) · points → score_events
        </p>
      </div>

      <CreateEntryForm challenges={challenges} teams={teams} onCreate={handleEntryCreate} />

      {loading ? (
        <p className="text-canal-gray-muted text-sm text-center py-8">Chargement…</p>
      ) : (
        challenges.map((c) => {
          const list = entries.filter((e) => e.challenge_id === c.id);
          return (
            <section key={c.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-black text-white text-sm flex items-center gap-2">
                  <span className="text-lg">{c.emoji}</span> {c.title}
                  <span className="text-xs text-canal-gray-muted font-normal">({c.max_points} pts max)</span>
                </h2>
                <select
                  value={c.status}
                  onChange={(e) => setChallengeStatus(c, e.target.value as ChallengeStatus)}
                  className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1 text-xs text-white"
                >
                  {CHALLENGE_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              {list.length === 0 ? (
                <p className="text-canal-gray-muted text-xs pl-1">Aucune participation.</p>
              ) : (
                <div className="space-y-2">
                  {list.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      maxPoints={c.max_points}
                      onChange={handleEntryChange}
                      onDelete={handleEntryDelete}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
