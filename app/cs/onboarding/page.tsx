"use client";

// Onboarding sport-neutre CANAL Sports — P1.
//
// MVP volontairement minimal : nom affiché + service. L'email vient de
// l'auth (magic link), pas demandé ici. Pas de "niveau foot" (c'était une
// question spécifique à Canal Cup) ; les préférences de sport viendront
// plus tard, quand un vrai catalogue Sport/Competition existera (P2+).
// Poste sur le même endpoint que l'onboarding Canal Cup
// (/api/profile/onboard), football_level simplement omis.

import { Suspense, useEffect, useState } from "react";
import { User, Briefcase, ChevronRight, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, DEFAULT_TZ, detectTimezone } from "@/lib/utils";
import { productConfig } from "@/lib/product/config";

interface Service {
  id: string;
  name: string;
  emoji?: string;
}

function OnboardingInner() {
  const [services, setServices] = useState<Service[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setServices(d); })
      .catch(() => {});

    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: row } = await supabase
        .from("users")
        .select("display_name, name, service_id")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (row?.display_name || row?.name) setDisplayName(row.display_name ?? row.name ?? "");
      if (row?.service_id) setServiceId(row.service_id);
    })();
  }, []);

  const isValid = displayName.trim().length >= 2 && !!serviceId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          service_id: serviceId,
          timezone: detectTimezone() || DEFAULT_TZ || productConfig.defaultTimezone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        setSaving(false);
        return;
      }
      window.location.href = "/cs";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <p className="text-primary font-black text-2xl tracking-tight mb-3">
            {productConfig.shortName}
          </p>
          <h1 className="canal-headline text-xl mb-1 text-foreground">Bienvenue ! 👋</h1>
          <p className="text-muted-foreground text-sm">Une dernière étape avant de commencer.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs text-primary font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User size={12} /> Ton pseudo
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder='Ex : "Vincent"'
              maxLength={30}
              required
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-primary font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {s.emoji && <span className="text-lg">{s.emoji}</span>}
                  <span className="text-center leading-tight">{s.name}</span>
                </button>
              ))}
              {services.length === 0 && (
                <p className="col-span-3 text-muted-foreground text-xs">Chargement…</p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-canal-red text-xs text-center flex items-center justify-center gap-1.5">
              <AlertCircle size={12} /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid || saving}
            className="w-full py-4 bg-primary text-primary-foreground font-black text-base rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? "Enregistrement…" : "C'est parti !"}
            {!saving && <ChevronRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CanalSportsOnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <OnboardingInner />
    </Suspense>
  );
}
