"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Service, FootballLevel } from "@/lib/supabase/types";
import { User, Briefcase, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const FOOTBALL_LEVELS: { value: FootballLevel; label: string; desc: string; emoji: string }[] = [
  { value: "expert", label: "Expert", desc: "Je connais le hors-jeu, le faux pivot et les stats xG", emoji: "⚽" },
  { value: "amateur", label: "Amateur", desc: "Je regarde les grands matchs et je connais les équipes", emoji: "📺" },
  { value: "ambiance", label: "Je viens pour l'ambiance", desc: "Le foot ? Je viens pour les petits fours et l'équipe", emoji: "🎉" },
];

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
  const [displayName, setDisplayName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [footballLevel, setFootballLevel] = useState<FootballLevel | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services").then(r => r.json()).then(setServices);
  }, []);

  const isValid = displayName.trim().length >= 2 && serviceId && footballLevel;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const slug = slugify(displayName.trim());

    const { error: updateErr } = await supabase
      .from("users")
      .update({
        display_name: displayName.trim(),
        user_slug: slug,
        service_id: serviceId,
        football_level: footballLevel,
        profile_completed: true,
        onboarding_step: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_id", user.id);

    if (updateErr) {
      setError("Erreur lors de l'enregistrement. Réessayez.");
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
