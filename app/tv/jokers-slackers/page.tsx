"use client";

// Écran TV "Wall of Shame" des jokers — dénonce gentiment celles et ceux qui
// n'ont pas (ou peu) utilisé leurs jokers. Polling léger toutes les 15 s.

import { useEffect, useState } from "react";

interface Row { name: string; unused: number; played: number }
interface Data {
  neverPlayed: Row[];
  partial: Row[];
  stats: { totalPlayers: number; neverPlayedCount: number; totalUnused: number; totalPlayed: number };
}

export default function TvJokersSlackersPage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    const load = () => fetch("/api/tv/jokers-slackers").then((r) => r.json()).then((d) => { if (!d.error) setData(d); }).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const neverPlayed = data?.neverPlayed ?? [];
  const partial = data?.partial ?? [];
  const s = data?.stats;

  return (
    <div className="w-full min-h-screen bg-canal-black text-white overflow-hidden flex flex-col p-8">
      <header className="flex items-center justify-between mb-6">
        <h1 className="canal-headline text-6xl tracking-tight">
          LES <span className="text-amber-400">DORMEURS</span> 😴🃏
        </h1>
        <p className="text-2xl text-canal-gray-muted">Canal Cup — qui n'ose pas jouer ses jokers&nbsp;?</p>
      </header>

      {/* Bandeau stats */}
      {s && (
        <div className="grid grid-cols-3 gap-6 mb-6">
          <Stat value={s.neverPlayedCount} label="n'ont JAMAIS joué" color="text-red-400" />
          <Stat value={s.totalUnused} label="jokers qui dorment" color="text-amber-400" />
          <Stat value={s.totalPlayed} label="jokers dégainés" color="text-green-400" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Mur de la honte : zéro joker joué */}
        <section className="canal-card bg-canal-gray-dark/40 overflow-hidden flex flex-col">
          <h2 className="text-2xl text-red-300 font-bold uppercase mb-4">🚨 Zéro joker joué</h2>
          <ul className="space-y-3 overflow-hidden">
            {neverPlayed.slice(0, 12).map((r, i) => (
              <li key={i} className="flex items-center justify-between text-3xl leading-snug border-b border-white/5 pb-3">
                <span>{i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}{r.name}</span>
                <span className="text-amber-400 font-bold">{r.unused} 🃏</span>
              </li>
            ))}
            {neverPlayed.length === 0 && (
              <li className="text-2xl text-canal-gray-muted">Tout le monde a osé&nbsp;! Respect. 🔥</li>
            )}
          </ul>
        </section>

        {/* En garde-le-sous-le-coude */}
        <section className="canal-card bg-canal-gray-dark/40 overflow-hidden flex flex-col">
          <h2 className="text-2xl text-amber-200 font-bold uppercase mb-4">🤏 Ils gardent des jokers au chaud</h2>
          <ul className="space-y-3 overflow-hidden">
            {partial.slice(0, 12).map((r, i) => (
              <li key={i} className="flex items-center justify-between text-3xl leading-snug border-b border-white/5 pb-3">
                <span>{r.name}</span>
                <span className="text-canal-gray-muted text-2xl">{r.played} joué{r.played > 1 ? "s" : ""} · <span className="text-amber-400 font-bold">{r.unused} restant{r.unused > 1 ? "s" : ""}</span></span>
              </li>
            ))}
            {partial.length === 0 && (
              <li className="text-2xl text-canal-gray-muted">Personne pour l'instant.</li>
            )}
          </ul>
        </section>
      </div>

      <footer className="mt-6 text-center text-3xl text-canal-yellow font-bold">
        Un joker non joué = un joker perdu. Bougez-vous&nbsp;! 🎰
      </footer>
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="canal-card bg-canal-gray-dark/40 text-center py-4">
      <p className={`text-6xl font-black ${color}`}>{value}</p>
      <p className="text-xl text-canal-gray-muted mt-1">{label}</p>
    </div>
  );
}
