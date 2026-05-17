"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check, X, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

function headers() {
  return { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET };
}

interface BabyFootTeam {
  id: string;
  name: string;
  color: string;
  logo_url?: string;
  created_at: string;
  match_count: number;
}

// ─── Inline rename editor ─────────────────────────────────────────────────────

function TeamRow({
  team,
  onUpdate,
  onDelete,
}: {
  team: BabyFootTeam;
  onUpdate: (t: BabyFootTeam) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim()) { setError("Le nom est requis."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/babyfoot/teams", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ id: team.id, name, color }),
    });
    if (res.ok) {
      onUpdate({ ...team, name: name.trim(), color });
      setEditing(false);
    } else {
      const d = await res.json();
      setError(d.error ?? "Erreur serveur.");
    }
    setSaving(false);
  };

  const cancel = () => {
    setName(team.name);
    setColor(team.color);
    setError("");
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer l'équipe "${team.name}" ?`)) return;
    const res = await fetch(`/api/admin/babyfoot/teams?id=${team.id}`, {
      method: "DELETE",
      headers: { "x-admin-secret": ADMIN_SECRET },
    });
    if (res.ok) {
      onDelete(team.id);
    } else {
      const d = await res.json();
      alert(d.error ?? "Erreur lors de la suppression.");
    }
  };

  return (
    <div className="canal-card space-y-2">
      {editing ? (
        <>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-canal-gray-light bg-transparent cursor-pointer shrink-0"
              title="Couleur de l'équipe"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
              autoFocus
              className="flex-1 bg-canal-gray-mid border border-canal-yellow/50 rounded-lg px-3 py-2 text-white text-sm font-bold focus:outline-none"
            />
            <button
              onClick={save}
              disabled={saving}
              className="p-1.5 bg-canal-green/20 text-canal-green rounded-lg hover:bg-canal-green/30 disabled:opacity-50"
            >
              <Check size={14} />
            </button>
            <button
              onClick={cancel}
              className="p-1.5 bg-canal-gray-mid text-canal-gray-muted rounded-lg hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
          {error && <p className="text-red-400 text-xs pl-1">{error}</p>}
        </>
      ) : (
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full shrink-0 border border-canal-gray-light"
            style={{ backgroundColor: team.color }}
          />
          <span className="flex-1 font-bold text-white text-sm truncate">{team.name}</span>
          <span className="text-xs text-canal-gray-muted shrink-0">
            {team.match_count} match{team.match_count !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 text-canal-gray-muted hover:text-white transition-colors"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={handleDelete}
            className={cn(
              "p-1.5 transition-colors",
              team.match_count > 0
                ? "text-canal-gray-light cursor-not-allowed opacity-40"
                : "text-canal-gray-muted hover:text-red-400"
            )}
            title={team.match_count > 0 ? "Supprime les matchs liés d'abord" : "Supprimer"}
            disabled={team.match_count > 0}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Create team form ─────────────────────────────────────────────────────────

function CreateTeamForm({ onCreate }: { onCreate: (t: BabyFootTeam) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#FFD700");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim()) { setError("Le nom est requis."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/babyfoot/teams", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name, color }),
    });
    if (res.ok) {
      onCreate(await res.json());
      setName("");
      setColor("#FFD700");
    } else {
      const d = await res.json();
      setError(d.error ?? "Erreur serveur.");
    }
    setSaving(false);
  };

  return (
    <div className="canal-card space-y-4">
      <p className="text-canal-yellow font-bold text-sm flex items-center gap-2">
        <Plus size={14} /> Nouvelle équipe
      </p>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-10 rounded-lg border border-canal-gray-light bg-transparent cursor-pointer shrink-0"
          title="Couleur de l'équipe"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="Nom de l'équipe…"
          className="flex-1 bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-white text-sm placeholder:text-canal-gray-muted focus:outline-none focus:border-canal-yellow transition-colors"
        />
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-50 text-sm"
      >
        {saving ? "Enregistrement…" : "Créer l'équipe"}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminBabyFootTeamsPage() {
  const [teams, setTeams] = useState<BabyFootTeam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/babyfoot/teams", {
      headers: { "x-admin-secret": ADMIN_SECRET },
    });
    if (res.ok) setTeams(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdate = (updated: BabyFootTeam) =>
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? { ...updated, match_count: t.match_count } : t)));

  const handleDelete = (id: string) =>
    setTeams((prev) => prev.filter((t) => t.id !== id));

  const handleCreate = (t: BabyFootTeam) =>
    setTeams((prev) => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)));

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="canal-headline text-2xl">Admin — Équipes Babyfoot</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          {teams.length} équipe{teams.length !== 1 ? "s" : ""} · Ces équipes peuvent être sélectionnées dans les matchs
        </p>
      </div>

      <CreateTeamForm onCreate={handleCreate} />

      {loading ? (
        <p className="text-canal-gray-muted text-sm text-center py-8">Chargement…</p>
      ) : teams.length === 0 ? (
        <p className="text-canal-gray-muted text-sm text-center py-8">
          Aucune équipe. Crée la première ci-dessus.
        </p>
      ) : (
        <div className="space-y-2">
          {teams.map((t) => (
            <TeamRow
              key={t.id}
              team={t}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
