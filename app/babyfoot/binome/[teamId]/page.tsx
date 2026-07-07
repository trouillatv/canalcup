// Fiche d'un binôme baby-foot — la MÉMOIRE : stats de l'édition en cours,
// meilleure victoire, éliminé par qui, palmarès des éditions passées.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getBinomeFiche } from "@/lib/data/babyfoot";
import { BABYFOOT } from "@/lib/config/babyfoot";
import { ArrowLeft, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BinomeFichePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const fiche = await getBinomeFiche(teamId);
  if (!fiche) notFound();

  const c = fiche.current;
  const slotLabel = (k: string) => BABYFOOT.slots.find((s) => s.key === k)?.label ?? k;

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <Link href="/babyfoot" className="inline-flex items-center gap-1 text-canal-yellow text-sm"><ArrowLeft size={14} /> Tournoi</Link>

      <div className="text-center">
        <p className="text-5xl">🏓</p>
        <h1 className="canal-headline text-2xl mt-2">{fiche.label}</h1>
        {c?.resultLabel && <p className="text-canal-yellow font-black mt-1">{c.resultLabel}</p>}
      </div>

      {c ? (
        <>
          {/* Stats de l'édition en cours */}
          <div className="grid grid-cols-3 gap-2">
            <Stat v={c.played} l="Matchs" />
            <Stat v={c.won} l="Victoires" accent="text-green-400" />
            <Stat v={c.lost} l="Défaites" />
            <Stat v={c.gf} l="Buts pour" />
            <Stat v={c.ga} l="Buts contre" />
            <Stat v={c.gd > 0 ? `+${c.gd}` : c.gd} l="Différence" accent="text-canal-yellow" />
          </div>

          {(c.bestWin || c.eliminatedBy) && (
            <div className="canal-card space-y-2 text-sm">
              {c.bestWin && (
                <p className="flex items-center justify-between">
                  <span className="text-canal-gray-muted">Meilleure victoire</span>
                  <span className="text-white font-bold">{c.bestWin.score} <span className="text-canal-gray-muted font-normal">vs {c.bestWin.opponent}</span></span>
                </p>
              )}
              {c.eliminatedBy && (
                <p className="flex items-center justify-between">
                  <span className="text-canal-gray-muted">Éliminé par</span>
                  <span className="text-white font-bold">{c.eliminatedBy}</span>
                </p>
              )}
            </div>
          )}

          {c.availability.length > 0 && (
            <div className="canal-card">
              <p className="text-xs font-bold uppercase text-canal-gray-muted mb-2">Disponibilités</p>
              <div className="flex flex-wrap gap-1.5">
                {c.availability.map((k) => (
                  <span key={k} className="text-xs bg-canal-yellow/15 text-canal-yellow rounded-full px-2 py-1">✓ {slotLabel(k)}</span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-center text-canal-gray-muted text-sm">Ce binôme n&apos;est pas engagé dans l&apos;édition en cours.</p>
      )}

      {/* Palmarès des éditions passées */}
      {fiche.history.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase text-canal-yellow mb-2 flex items-center gap-1.5"><Trophy size={14} /> Palmarès</h2>
          <div className="canal-card divide-y divide-canal-gray-mid">
            {fiche.history.map((h) => (
              <div key={h.season} className="flex items-center justify-between py-2 text-sm">
                <span className="text-canal-gray-muted">{h.season}</span>
                <span className="text-white font-bold">{h.resultLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ v, l, accent }: { v: number | string; l: string; accent?: string }) {
  return (
    <div className="canal-card text-center py-3">
      <p className={`text-2xl font-black ${accent ?? "text-white"}`}>{v}</p>
      <p className="text-[10px] text-canal-gray-muted mt-0.5">{l}</p>
    </div>
  );
}
