"use client";

// Choix du fuseau horaire depuis /profile. Détermine dans quel fuseau
// l'abonné voit les horaires de match. Sauvegarde immédiate via
// /api/profile/timezone, puis refresh pour que le layout (qui alimente
// le contexte) reprenne la nouvelle valeur.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { TZ_OPTIONS, normalizeTimezone, detectTimezone } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function TimezoneSelector({ currentTz }: { currentTz: string }) {
  const router = useRouter();
  const [tz, setTz] = useState(normalizeTimezone(currentTz));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const detected = typeof window !== "undefined" ? detectTimezone() : tz;
  const showDetectHint = detected !== tz;

  const save = async (next: string) => {
    if (next === tz || saving) return;
    setSaving(next);
    setError("");
    try {
      const res = await fetch("/api/profile/timezone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ timezone: next }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setTz(normalizeTimezone(next));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="canal-card" aria-labelledby="tz-heading">
      <h2
        id="tz-heading"
        className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5"
      >
        <Globe size={14} /> Mon fuseau horaire
      </h2>
      <p className="text-xs text-canal-gray-muted mb-3 leading-relaxed">
        Les horaires de match s&apos;affichent dans ce fuseau. Choisis ta
        région.
      </p>
      <div className="space-y-2">
        {TZ_OPTIONS.map((o) => {
          const active = o.tz === tz;
          return (
            <button
              key={o.tz}
              type="button"
              onClick={() => save(o.tz)}
              disabled={!!saving}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all disabled:opacity-50",
                active
                  ? "bg-canal-yellow/10 border-canal-yellow text-white"
                  : "bg-canal-gray-mid border-canal-gray-light text-canal-gray-muted hover:text-white"
              )}
            >
              <span className="text-xl flex-shrink-0">{o.flag}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm">{o.region}</p>
                <p className="text-xs opacity-70">Heure « {o.label} »</p>
              </div>
              {saving === o.tz ? (
                <span className="text-canal-gray-muted text-xs">…</span>
              ) : active ? (
                <Check size={16} className="text-canal-yellow flex-shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>
      {showDetectHint && (
        <button
          type="button"
          onClick={() => save(detected)}
          className="text-xs text-canal-yellow underline mt-3"
        >
          Ton appareil semble être sur « {TZ_OPTIONS.find((o) => o.tz === detected)?.label} » — utiliser cette région ?
        </button>
      )}
      {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
    </section>
  );
}
