"use client";

// Écran TV spécial "Chaos" — dénonce publiquement les jokers joués.
// NE REMPLACE PAS /tv (rotation principale). Polling léger toutes les 10 s.

import { useEffect, useState } from "react";
import { JOKER_CATALOG, type JokerType } from "@/lib/jokers/catalog";

interface PlayRow {
  id: string; jokerType: string; playerName: string; targetName: string | null;
  matchLabel: string | null; metadata: Record<string, unknown>; status: string; createdAt: string;
}
interface FogRow { name: string; endsAt: string | null }
interface RedCardRow { name: string; matchLabel: string | null }
interface ChaosData { recentPlays: PlayRow[]; fog: FogRow[]; flightDelay: FogRow[]; redCards: RedCardRow[] }

function playLine(p: PlayRow): string {
  const def = JOKER_CATALOG[p.jokerType as JokerType];
  const emoji = def?.emoji ?? "🃏";
  switch (p.jokerType) {
    case "casino": {
      const d = Number((p.metadata as { points_delta?: number })?.points_delta ?? 0);
      return `${emoji} ${p.playerName} a tenté le Casino : ${d > 0 ? "+" : ""}${d} pts`;
    }
    case "quitte_ou_double":
      return `${emoji} ${p.playerName} joue Quitte ou Double${p.matchLabel ? ` sur ${p.matchLabel}` : ""}`;
    case "kamikaze": {
      const tier = (p.metadata as { tier?: string })?.tier;
      const pts = (p.metadata as { points?: number })?.points;
      if (tier === "exact") return `${emoji}🎯 ${p.playerName} a fait EXPLOSER le Kamikaze : +${pts} pts !`;
      if (tier === "wrong") return `${emoji}💀 ${p.playerName} s'est crashé au Kamikaze : ${pts} pts`;
      if (tier === "result") return `${emoji} ${p.playerName} a survécu au Kamikaze : 0 pt`;
      return `${emoji} ${p.playerName} a activé le Kamikaze${p.matchLabel ? ` sur ${p.matchLabel}` : ""} — score exact ou rien`;
    }
    case "carton_rouge":
      return `${emoji} ${p.playerName} a sorti le Carton Rouge sur ${p.targetName}${p.matchLabel ? ` (${p.matchLabel})` : ""}`;
    case "brouillard":
      return `${emoji} ${p.playerName} a plongé ${p.targetName} dans le Brouillard`;
    case "retard_avion":
      // 🛬 Jet Lag : on ne révèle pas la victime (surprise jusqu'au coup de sifflet).
      return `${emoji} ${p.playerName} a programmé un Jet Lag${p.matchLabel ? ` sur ${p.matchLabel}` : ""}… 😴`;
    case "espion":
      return `${emoji} ${p.playerName} espionne les pronos des autres…`;
    case "var":
      return `${emoji} ${p.playerName} active la VAR${p.matchLabel ? ` sur ${p.matchLabel}` : ""}`;
    default:
      return `${emoji} ${p.playerName}`;
  }
}

export default function TvChaosPage() {
  const [data, setData] = useState<ChaosData | null>(null);

  useEffect(() => {
    const load = () => fetch("/api/tv/chaos").then((r) => r.json()).then((d) => { if (!d.error) setData(d); }).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full min-h-screen bg-canal-black text-white overflow-hidden flex flex-col p-8">
      <header className="flex items-center justify-between mb-6">
        <h1 className="canal-headline text-6xl tracking-tight">
          MODE <span className="text-purple-400">CHAOS</span> 🃏
        </h1>
        <p className="text-2xl text-canal-gray-muted">Canal Cup — qui se tire dans les pattes ?</p>
      </header>

      <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Flux des jokers joués */}
        <section className="col-span-2 canal-card bg-canal-gray-dark/40 overflow-hidden flex flex-col">
          <h2 className="text-xl text-purple-300 font-bold uppercase mb-3">Derniers jokers joués</h2>
          <ul className="space-y-3 overflow-hidden">
            {(data?.recentPlays ?? []).slice(0, 10).map((p) => (
              <li key={p.id} className="text-3xl leading-snug border-b border-white/5 pb-3">
                {playLine(p)}
              </li>
            ))}
            {(!data || data.recentPlays.length === 0) && (
              <li className="text-2xl text-canal-gray-muted">Calme plat… pour l'instant. 😏</li>
            )}
          </ul>
        </section>

        {/* Effets actifs */}
        <section className="flex flex-col gap-4 min-h-0">
          <div className="canal-card bg-canal-gray-dark/40">
            <h2 className="text-lg text-blue-300 font-bold uppercase mb-2">🌫 Dans le Brouillard</h2>
            <ul className="space-y-1 text-2xl">
              {(data?.fog ?? []).map((f, i) => <li key={i}>{f.name}</li>)}
              {(!data || data.fog.length === 0) && <li className="text-canal-gray-muted text-xl">Personne.</li>}
            </ul>
          </div>
          <div className="canal-card bg-canal-gray-dark/40">
            <h2 className="text-lg text-red-400 font-bold uppercase mb-2">🚫 Cartons Rouges</h2>
            <ul className="space-y-1 text-2xl">
              {(data?.redCards ?? []).map((r, i) => (
                <li key={i}>{r.name}{r.matchLabel ? <span className="text-base text-canal-gray-muted block">{r.matchLabel}</span> : null}</li>
              ))}
              {(!data || data.redCards.length === 0) && <li className="text-canal-gray-muted text-xl">Aucun.</li>}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
