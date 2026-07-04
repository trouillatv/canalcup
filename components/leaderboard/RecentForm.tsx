"use client";

// 🔥 Classement « Forme récente » des pronostics — qui est chaud sur la période,
// indépendamment du général cumulé. 100 % analytique (read-only).

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Flame, Target, Repeat, Rocket } from "lucide-react";

interface Row {
  user_id: string;
  display_name: string;
  team_name: string | null;
  points: number;
  pronos: number;
  good: number;
  exact: number;
  avg: number;
  rank: number;
  trend: number;
}
interface Payload {
  period: string;
  periodLabel: string;
  matchesCount: number;
  rows: Row[];
  highlights: {
    bestExact: { name: string; value: number } | null;
    mostRegular: { name: string; value: number } | null;
    biggestClimb: { name: string; value: number } | null;
  };
}

const PERIODS: { id: string; label: string }[] = [
  { id: "3d", label: "3 jours" },
  { id: "7d", label: "7 jours" },
  { id: "14d", label: "14 jours" },
  { id: "phase", label: "Phase" },
  { id: "last10", label: "10 matchs" },
];

function medal(rank: number) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
}

export function RecentForm() {
  const [period, setPeriod] = useState("7d");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/leaderboard/form?period=${period}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => { if (alive) { setData(d as Payload); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [period]);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-canal-gray-muted text-xs">
          Qui est <b className="text-white">chaud</b> en ce moment sur les pronos — sur les matchs joués de la période.
          <span className="block text-canal-gray-muted/70 mt-0.5">N&apos;affecte pas le classement général (analytique).</span>
        </p>
      </div>

      {/* Sélecteur de période */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              period === p.id ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-canal-gray-muted hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Période utilisée */}
      {data && (
        <p className="text-[11px] text-canal-yellow/80 font-bold flex items-center gap-1.5">
          <Flame size={13} /> {data.periodLabel} · {data.matchesCount} match{data.matchesCount > 1 ? "s" : ""} pris en compte
        </p>
      )}

      {/* Mises en avant */}
      {data && data.rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Highlight icon={<Target size={14} />} label="Meilleur aux scores exacts" v={data.highlights.bestExact} suffix={(n) => `${n} exact${n > 1 ? "s" : ""}`} />
          <Highlight icon={<Repeat size={14} />} label="Le plus assidu" v={data.highlights.mostRegular} suffix={(n) => `${n} prono${n > 1 ? "s" : ""}`} />
          <Highlight icon={<Rocket size={14} />} label="Remonte le plus" v={data.highlights.biggestClimb} suffix={(n) => `+${n} places vs général`} />
        </div>
      )}

      {/* Tableau */}
      {loading && !data ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" /></div>
      ) : !data || data.rows.length === 0 ? (
        <div className="canal-card text-center py-6 text-canal-gray-muted text-sm">Aucun prono joué sur cette période.</div>
      ) : (
        <div className="space-y-2">
          {data.rows.map((r) => (
            <Link
              key={r.user_id}
              href={`/joueur/${r.user_id}`}
              className={`canal-card flex items-center gap-2 hover:bg-canal-gray-mid transition-colors ${r.rank === 1 ? "border border-canal-yellow/30" : ""}`}
            >
              <div className="w-8 text-center font-black text-lg flex-shrink-0">{medal(r.rank)}</div>
              <div className="flex-1 min-w-0 ml-1">
                <p className="font-bold text-white truncate text-sm flex items-center gap-1.5">
                  {r.display_name}
                  {r.trend > 0 && <TrendingUp size={13} className="text-green-400 shrink-0" />}
                  {r.trend < 0 && <TrendingDown size={13} className="text-red-400/70 shrink-0" />}
                </p>
                <p className="text-[11px] text-canal-gray-muted truncate">
                  {r.team_name ?? "Sans binôme"} · {r.pronos} prono{r.pronos > 1 ? "s" : ""} · {r.good} bon{r.good > 1 ? "s" : ""} (V/N/D) · 🎯 {r.exact} · ⌀ {r.avg}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-canal-yellow text-lg tabular-nums">{r.points}</p>
                <p className="text-[10px] text-canal-gray-muted">pts</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Highlight({
  icon, label, v, suffix,
}: { icon: React.ReactNode; label: string; v: { name: string; value: number } | null; suffix: (n: number) => string }) {
  return (
    <div className="canal-card py-2.5 px-3">
      <p className="text-[10px] text-canal-gray-muted uppercase tracking-wide flex items-center gap-1">{icon} {label}</p>
      {v ? (
        <>
          <p className="font-black text-white text-sm truncate mt-0.5">{v.name}</p>
          <p className="text-[11px] text-canal-yellow font-bold">{suffix(v.value)}</p>
        </>
      ) : (
        <p className="text-canal-gray-muted text-xs italic mt-1">—</p>
      )}
    </div>
  );
}
