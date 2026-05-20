"use client";

// Form d'édition du profil utilisateur (phase 1).
// Champs éditables : name, display_name (régénère user_slug), service_id,
// football_level. Email et team_id sont AFFICHÉS read-only ailleurs sur la
// page ; on ne les touche pas ici (changement email = flux Supabase Auth
// séparé ; changement team = levier admin pour le scoring).
//
// La contrainte DB users_profile_complete_chk garantit que ces champs
// restent renseignés tant que profile_completed=true ; la validation
// client n'est qu'une UX (pas une sécurité).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Service, FootballLevel } from "@/lib/supabase/types";
import { User, Briefcase, Mail, Save, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const FOOTBALL_LEVELS: { value: FootballLevel; label: string; desc: string; emoji: string }[] = [
  { value: "expert", label: "Expert", desc: "Hors-jeu, faux pivot, xG — RAS", emoji: "⚽" },
  { value: "amateur", label: "Amateur", desc: "Je connais les équipes et les grands matchs", emoji: "📺" },
  { value: "ambiance", label: "Ambiance", desc: "Je viens pour l'équipe et les petits fours", emoji: "🎉" },
];

interface ProfileLite {
  id: string;
  name: string | null;
  display_name?: string | null;
  user_slug?: string | null;
  email: string;
  service_id?: string | null;
  football_level: FootballLevel;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function ProfileEditForm({
  profile,
  services,
}: {
  profile: ProfileLite;
  services: Service[];
}) {
  const router = useRouter();
  const [name, setName] = useState(profile.name ?? "");
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [serviceId, setServiceId] = useState(profile.service_id ?? "");
  const [footballLevel, setFootballLevel] = useState<FootballLevel>(profile.football_level);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length >= 2;
  const displayOk = displayName.trim().length >= 2;
  const isValid = nameOk && displayOk && !!serviceId && !!footballLevel;
  const slugPreview = displayOk ? slugify(displayName) : profile.user_slug ?? "";

  const dirty =
    name.trim() !== (profile.name ?? "") ||
    displayName.trim() !== (profile.display_name ?? "") ||
    serviceId !== (profile.service_id ?? "") ||
    footballLevel !== profile.football_level;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !dirty) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);

    const supabase = createClient();
    // .select().single() pour DÉTECTER si l'update a vraiment touché 1 ligne.
    // Sans select, une update bloquée par RLS renvoie data:null sans error
    // → on croit que c'est sauvé alors que rien n'a bougé. Avec select+single,
    // 0 ligne touchée → error PGRST116 → on surface vraiment l'échec.
    const { data: updated, error: upErr } = await supabase
      .from("users")
      .update({
        name: name.trim(),
        display_name: displayName.trim(),
        user_slug: slugify(displayName),
        service_id: serviceId,
        football_level: footballLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .select("id, name, display_name")
      .single();

    if (upErr || !updated) {
      setError(
        upErr?.message ??
          "Aucune ligne mise à jour — la base a refusé silencieusement (RLS ?). Recharge la page et réessaie."
      );
      setSaving(false);
      return;
    }
    setSavedAt(Date.now());
    setSaving(false);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nom complet */}
      <div>
        <label className="text-[11px] text-canal-gray-muted font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <User size={11} /> Nom
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
          className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-canal-yellow transition-colors"
        />
      </div>

      {/* Nom de pronostic */}
      <div>
        <label className="text-[11px] text-canal-gray-muted font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <User size={11} /> Nom de pronostic
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={30}
          className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-canal-yellow transition-colors"
        />
        {displayOk && (
          <p className="text-[11px] text-canal-gray-muted mt-1">
            Profil public : /u/{slugPreview}
          </p>
        )}
      </div>

      {/* Email — read-only */}
      <div>
        <label className="text-[11px] text-canal-gray-muted font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <Mail size={11} /> Email (login)
        </label>
        <input
          type="email"
          value={profile.email}
          readOnly
          className="w-full bg-canal-gray-mid/40 border border-canal-gray-light/40 rounded-xl px-3 py-2 text-canal-gray-muted text-sm cursor-not-allowed"
        />
        <p className="text-[11px] text-canal-gray-muted mt-1">
          Non modifiable ici — contacte un admin pour changer.
        </p>
      </div>

      {/* Service */}
      <div>
        <label className="text-[11px] text-canal-gray-muted font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Briefcase size={11} /> Mon service
        </label>
        <div className="grid grid-cols-3 gap-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceId(s.id)}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-2 rounded-xl border text-xs font-bold transition-all",
                serviceId === s.id
                  ? "bg-canal-yellow text-canal-black border-canal-yellow"
                  : "bg-canal-gray-mid text-canal-gray-muted border-canal-gray-light hover:text-white"
              )}
            >
              <span className="text-base">{s.emoji}</span>
              <span className="text-center leading-tight">{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Niveau foot */}
      <div>
        <label className="text-[11px] text-canal-gray-muted font-bold uppercase tracking-wider mb-2 block">
          Mon niveau foot
        </label>
        <div className="space-y-2">
          {FOOTBALL_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setFootballLevel(level.value)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-all",
                footballLevel === level.value
                  ? "bg-canal-yellow/10 border-canal-yellow text-white"
                  : "bg-canal-gray-mid border-canal-gray-light text-canal-gray-muted hover:text-white"
              )}
            >
              <span className="text-lg flex-shrink-0">{level.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{level.label}</p>
                <p className="text-[11px] opacity-70 leading-tight truncate">{level.desc}</p>
              </div>
              {footballLevel === level.value && (
                <Check size={14} className="text-canal-yellow shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-xs text-center flex items-center justify-center gap-1.5">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!isValid || !dirty || saving}
        className={cn(
          "w-full py-3 font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-colors",
          savedAt && !dirty
            ? "bg-green-800/40 text-green-400 border border-green-700/40"
            : "bg-canal-yellow text-canal-black hover:bg-canal-yellow-hover disabled:opacity-40"
        )}
      >
        {saving ? (
          "Enregistrement…"
        ) : savedAt && !dirty ? (
          <>
            <Check size={14} /> Enregistré
          </>
        ) : (
          <>
            <Save size={14} /> Enregistrer
          </>
        )}
      </button>
    </form>
  );
}
