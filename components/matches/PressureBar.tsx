"use client";

// 🔥 Pression par équipe — courbe de momentum divergente (vert = équipe A pousse
// vers le haut, bleu = équipe B vers le bas). Une barre par tranche de 30 s
// captée par le cron live. Donnée DÉRIVÉE d'un mix pression + occasions + tirs
// cadrés (cf. /api/matches/[id]/pressure). Se masque tant qu'on n'a pas ≥ 2
// snapshots. En live, se rafraîchit toutes les 20 s (le graphe se construit).

import { useEffect, useState } from "react";
import { Flag } from "@/components/shared/Flag";

interface Point { value: number } // value ∈ [-1, 1]
interface Data {
  points: Point[];
  expectedTotal: number; // nb de tranches estimé pour un match de 90'
  htIndex: number | null; // index de la tranche mi-temps
  live: boolean;
  finished: boolean;
}

export function PressureBar({
  matchId,
  teamA,
  teamB,
  flagA,
  flagB,
}: {
  matchId: string;
  teamA: string;
  teamB: string;
  flagA?: string | null;
  flagB?: string | null;
}) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/matches/${matchId}/pressure`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Data | null) => {
          if (!alive) return;
          setData(d);
          // En live, on recharge toutes les 20 s → le graphe s'allonge tout seul.
          if (d?.live) timer = setTimeout(load, 20_000);
        })
        .catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [matchId]);

  if (!data || data.points.length < 2) return null;

  // Repère SVG (unités virtuelles, le viewBox s'étire en largeur 100 %).
  const W = 600, H = 180, cy = H / 2, padX = 10;
  const amp = cy - 12; // amplitude max d'une barre
  const pts = data.points;
  const total = Math.max(data.expectedTotal, pts.length); // dénominateur de l'axe X
  const span = W - padX * 2;
  const x = (i: number) => padX + (total > 1 ? (i / (total - 1)) * span : 0);
  const barW = Math.max(1.5, Math.min(8, (span / total) * 0.72));
  const lastIdx = pts.length - 1;

  return (
    <div className="rounded-2xl bg-canal-gray border border-canal-gray-light p-3 mb-4">
      <p className="text-[11px] font-black text-canal-yellow uppercase tracking-wider mb-2 px-1">
        🔥 Pression par équipe
      </p>
      <div className="flex items-stretch gap-2">
        {/* Drapeaux ronds : A en haut (vert), B en bas (bleu). */}
        <div className="flex flex-col justify-between py-1 shrink-0">
          <Flag flag={flagA} name={teamA} className="h-7 w-7 rounded-full ring-2 ring-green-500/50" emojiClassName="text-xl" />
          <Flag flag={flagB} name={teamB} className="h-7 w-7 rounded-full ring-2 ring-blue-500/50" emojiClassName="text-xl" />
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Pression par équipe">
          {/* Bandes de fond (haut = A, bas = B). */}
          <rect x={0} y={0} width={W} height={cy} fill="rgba(34,197,94,0.12)" />
          <rect x={0} y={cy} width={W} height={cy} fill="rgba(59,130,246,0.12)" />

          {/* Zone future (match en cours) : de la dernière tranche jusqu'au bout. */}
          {!data.finished && lastIdx < total - 1 && (
            <rect x={x(lastIdx)} y={0} width={W - padX - x(lastIdx)} height={H} fill="rgba(255,255,255,0.05)" />
          )}

          {/* Mi-temps. */}
          {data.htIndex != null && (
            <line x1={x(data.htIndex)} y1={0} x2={x(data.htIndex)} y2={H} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
          )}

          {/* Barres signées. */}
          {pts.map((p, i) => {
            const h = Math.abs(p.value) * amp;
            const up = p.value >= 0;
            return (
              <rect
                key={i}
                x={x(i) - barW / 2}
                y={up ? cy - h : cy}
                width={barW}
                height={Math.max(h, 0.6)}
                rx={1}
                fill={up ? "#22c55e" : "#3b82f6"}
              />
            );
          })}

          {/* Ligne centrale. */}
          <line x1={0} y1={cy} x2={W} y2={cy} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />

          {/* Coup d'envoi (vert) → tranche courante (rouge). */}
          <circle cx={x(0)} cy={H - 8} r={6} fill="#0e1117" stroke="#22c55e" strokeWidth={3} />
          <circle cx={x(lastIdx)} cy={8} r={6} fill="#0e1117" stroke="#ef4444" strokeWidth={3} />
        </svg>
      </div>
      <p className="text-[10px] text-canal-gray-muted mt-1.5 px-1">
        Indice dérivé (tirs cadrés · occasions · possession) — une barre / 30 s, en direct.
      </p>
    </div>
  );
}
