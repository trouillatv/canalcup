"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Service, FootballLevel } from "@/lib/supabase/types";
import { User, Briefcase, Users, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const FOOTBALL_LEVELS: { value: FootballLevel; label: string; desc: string; emoji: string }[] = [
  { value: "expert", label: "Expert", desc: "Je connais le hors-jeu, le faux pivot et les stats xG", emoji: "⚽" },
  { value: "amateur", label: "Amateur", desc: "Je regarde les grands matchs et je connais les équipes", emoji: "📺" },
  { value: "ambiance", label: "Je viens pour l'ambiance", desc: "Le foot ? Je viens pour les petits fours et l'équipe", emoji: "🎉" },
];

interface TeamLite {
  id: string;
  name: string;
  color?: string | null;
  logo_url?: string | null;
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

export default function OnboardingPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [teams, setTeams] = useState<TeamLite[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [footballLevel, setFootballLevel] = useState<FootballLevel | "">("");
  const [teamId, setTeamId] = useState("");
  const [returning, setReturning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services").then((r) => r.json()).then(setServices).catch(() => {});
    fetch("/api/teams").then((r) => r.json()).then(setTeams).catch(() => {});

    // Pré-remplir si l'utilisateur a déjà commencé (renvoyé ici car profil
    // incomplet : il ne doit pas re-saisir ce qui est déjà connu).
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: row } = await supabase
        .from("users")
        .select("display_name, name, service_id, football_level, team_id, profile_completed")
        .eq("auth_id", user.id)
        .single();
      if (!row) return;
      if (row.display_name || row.name) setDisplayName(row.display_name ?? row.name ?? "");
      if (row.service_id) setServiceId(row.service_id);
      if (row.football_level) setFootballLevel(row.football_level as FootballLevel);
      if (row.team_id) setTeamId(row.team_id);
      // "returning" = a déjà des données mais profil pas (ou plus) complété.
      if (!row.profile_completed && (row.display_name || row.name || row.service_id || row.team_id)) {
        setReturning(true);
      }
    })();
  }, []);

  const isValid =
    displayName.trim().length >= 2 && !!serviceId && !!footballLevel && !!teamId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const trimmed = displayName.trim();
    const slug = slugify(trimmed);

    const { error: updateErr } = await supabase
      .from("users")
      .update({
        name: trimmed,
        display_name: trimmed,
        user_slug: slug,
        service_id: serviceId,
        football_level: footballLevel,
        team_id: teamId,
        profile_completed: true,
        onboarding_step: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_id", user.id);

    if (updateErr) {
      // La contrainte DB users_profile_complete_chk refuse tout profil
      // incomplet — message clair plutôt qu'une erreur opaque.
      setError(
        "Profil incomplet ou erreur d'enregistrement — vérifie pseudo, service, niveau et équipe, puis réessaie."
      );
      setSaving(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-canal-black flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">

        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-canal-yellow font-black text-3xl tracking-tight">CANAL</span>
            <span className="text-white font-black text-3xl tracking-tight">CUP</span>
          </div>
          <h1 className="canal-headline text-xl mb-1">Bienvenue ! 👋</h1>
          <p className="text-canal-gray-muted text-sm">
            Dernière étape avant de jouer. 30 secondes max.
          </p>
        </div>

        {returning && (
          <div className="rounded-xl border border-canal-yellow/40 bg-canal-yellow/10 px-4 py-3 text-center">
            <p className="text-canal-yellow font-bold text-sm">Profil incomplet</p>
            <p className="text-canal-gray-muted text-xs mt-0.5">
              Il manque des infos obligatoires (notamment ton <b>équipe</b>) pour
              pouvoir pronostiquer. Complète et valide.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Pseudo */}
          <div>
            <label className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User size={12} /> Ton pseudo Canal Cup
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder='Ex : "Oracle du Nul", "Vincent", "Didier du VAR"'
              maxLength={30}
              required
              className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors"
            />
            {displayName.length >= 2 && (
              <p className="text-canal-gray-muted text-xs mt-1.5">
                Profil : /u/{slugify(displayName)}
              </p>
            )}
          </div>

          {/* Service */}
          <div>
            <label className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Briefcase size={12} /> Ton service
            </label>
            <div className="grid grid-cols-3 gap-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setServiceId(s.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-bold transition-all",
                    serviceId === s.id
                      ? "bg-canal-yellow text-canal-black border-canal-yellow"
                      : "bg-canal-gray-mid text-canal-gray-muted border-canal-gray-light hover:text-white"
                  )}
                >
                  <span className="text-lg">{s.emoji}</span>
                  <span className="text-center leading-tight">{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Équipe — OBLIGATOIRE (sinon impossible de pronostiquer) */}
          <div>
            <label className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users size={12} /> Ton équipe Canal Cup
            </label>
            <div className="space-y-2">
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTeamId(t.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                    teamId === t.id
                      ? "bg-canal-yellow/10 border-canal-yellow text-white"
                      : "bg-canal-gray-mid border-canal-gray-light text-canal-gray-muted hover:text-white"
                  )}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
                    style={{ backgroundColor: t.color ?? "#888" }}
                  />
                  <span className="font-bold text-sm flex-1 truncate">{t.name}</span>
                  {teamId === t.id && (
                    <span className="text-canal-yellow font-black text-sm">✓</span>
                  )}
                </button>
              ))}
              {teams.length === 0 && (
                <p className="text-canal-gray-muted text-xs">Chargement des équipes…</p>
              )}
            </div>
          </div>

          {/* Niveau foot */}
          <div>
            <label className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 block">
              Ton niveau foot
            </label>
            <div className="space-y-2">
              {FOOTBALL_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setFootballLevel(level.value)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                    footballLevel === level.value
                      ? "bg-canal-yellow/10 border-canal-yellow text-white"
                      : "bg-canal-gray-mid border-canal-gray-light text-canal-gray-muted hover:text-white"
                  )}
                >
                  <span className="text-xl flex-shrink-0">{level.emoji}</span>
                  <div>
                    <p className="font-bold text-sm">{level.label}</p>
                    <p className="text-xs opacity-70 leading-tight">{level.desc}</p>
                  </div>
                  {footballLevel === level.value && (
                    <span className="ml-auto text-canal-yellow font-black text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!isValid || saving}
            className="w-full py-4 bg-canal-yellow text-canal-black font-black text-base rounded-xl flex items-center justify-center gap-2 hover:bg-canal-yellow-hover transition-colors disabled:opacity-40"
          >
            {saving ? "Enregistrement…" : "C'est parti ⚽"}
            {!saving && <ChevronRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
