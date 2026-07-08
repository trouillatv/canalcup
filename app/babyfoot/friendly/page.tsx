"use client";

// /babyfoot/friendly — Journée amicale / entraînement (chauffe avant le tournoi
// officiel). Pas de points, pas de classement : juste dire « on veut jouer ».

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BABYFOOT } from "@/lib/config/babyfoot";
import { NoTeamCTA } from "@/components/teams/NoTeamCTA";
import { Loader2, PartyPopper } from "lucide-react";

interface Signup { id: string; name: string; note: string | null; }

export default function BabyfootFriendlyPage() {
  const [signups, setSignups] = useState<Signup[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/babyfoot/friendly").then((r) => r.json()).then((d) => setSignups(d.signups ?? [])).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const signup = async (cancel = false) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/babyfoot/friendly", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify(cancel ? { cancel: true } : { note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? "Action impossible.");
      else load();
    } catch { setError("Erreur réseau."); }
    finally { setBusy(false); }
  };

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl flex items-center gap-2"><span className="text-3xl">🎯</span> Journée amicale</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Entraînement baby-foot en amont — sans enjeu, juste pour le fun. Aucun point, aucun classement.
        </p>
      </div>

      <div className="canal-card border border-canal-yellow/30 bg-canal-yellow/5 text-sm text-canal-gray-muted">
        Viens te chauffer avant le grand tournoi du {BABYFOOT.eventLabel} 💪. Signale ton binôme pour qu&apos;on organise des matchs d&apos;entraînement.
      </div>

      <NoTeamCTA action="jouer un match amical" />

      <div className="canal-card space-y-3">
        <label className="text-xs font-bold uppercase text-canal-gray-muted">Un mot (optionnel)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Ex. dispo cet aprèm !"
          className="w-full px-3 py-2 rounded-xl bg-canal-gray-mid text-white text-sm border border-canal-gray-light focus:border-canal-yellow outline-none" />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => signup(false)} disabled={busy}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <PartyPopper size={16} />} On veut jouer !
          </button>
          <button onClick={() => signup(true)} disabled={busy} className="px-4 rounded-xl bg-canal-gray-mid text-canal-gray-muted text-sm">Retirer</button>
        </div>
      </div>

      {signups.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-2">Binômes partants ({signups.length})</h2>
          <div className="canal-card divide-y divide-canal-gray-light">
            {signups.map((su) => (
              <div key={su.id} className="py-2 text-sm">
                <span className="font-bold text-white">{su.name}</span>
                {su.note && <span className="text-canal-gray-muted"> — {su.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href="/babyfoot" className="block text-center text-sm text-canal-yellow underline">← Retour au tournoi</Link>
    </div>
  );
}
