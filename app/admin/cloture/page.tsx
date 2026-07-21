"use client";

// /admin/cloture — l'interrupteur de fin de tournoi.
//
// Un seul bouton, mais il change tout le site : bascule la home et /final sur la
// cérémonie, fait apparaître le bandeau « Canal Cup terminée » partout, et
// renvoie 403 sur toutes les écritures de jeu (pronos, quiz, jokers, baby-foot,
// commentaires, votes…). Les outils d'admin, eux, restent ouverts pour corriger.
//
// D'où la double confirmation et le rappel explicite que c'est réversible.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Lock, Unlock, ArrowLeft, ExternalLink, AlertTriangle, Loader2 } from "lucide-react";

type Status = "open" | "closed";

export default function ClotureAdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/event-status", { credentials: "same-origin" });
      if (!res.ok) throw new Error(res.status === 401 ? "Accès réservé aux organisateurs." : "Lecture impossible.");
      const json = await res.json();
      setStatus(json.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const apply = async (next: Status) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/event-status", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Bascule refusée");
      setStatus(json.status);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  const isClosed = status === "closed";

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-canal-gray-muted hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Admin
      </Link>

      <h1 className="canal-headline text-2xl mb-1">Clôture de la Canal Cup</h1>
      <p className="text-sm text-canal-gray-muted mb-6">
        L&apos;interrupteur global de fin de tournoi.
      </p>

      {error && (
        <div className="canal-card border-canal-red mb-4 text-sm text-canal-red">{error}</div>
      )}

      <div className="canal-card mb-4">
        <div className="flex items-center gap-3">
          {isClosed ? (
            <Lock className="w-8 h-8 text-canal-red shrink-0" />
          ) : (
            <Unlock className="w-8 h-8 text-canal-green shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-canal-gray-muted font-bold">État actuel</p>
            <p className="text-lg font-black text-white">
              {status === null ? "Chargement…" : isClosed ? "Terminée (verrouillée)" : "En cours (ouverte)"}
            </p>
          </div>
        </div>
      </div>

      <div className="canal-card mb-4 text-sm text-white/85 space-y-2">
        <p className="font-bold text-canal-yellow">Ce que fait la clôture :</p>
        <ul className="list-disc pl-5 space-y-1 text-canal-gray-muted">
          <li>La home et <code className="text-white">/final</code> affichent la cérémonie et le palmarès.</li>
          <li>Un bandeau « Canal Cup 2026 terminée » apparaît sur toutes les pages.</li>
          <li>Toutes les écritures de jeu sont refusées : pronos, quiz, jokers, baby-foot, équipes, votes, commentaires.</li>
          <li>Les pages et historiques restent consultables en lecture seule.</li>
          <li>Les outils <strong className="text-white">/admin</strong> restent ouverts pour corriger.</li>
        </ul>
        <p className="flex items-start gap-2 pt-1 text-canal-gray-muted">
          <AlertTriangle className="w-4 h-4 text-canal-yellow shrink-0 mt-0.5" />
          <span>
            Aucun score n&apos;est recalculé ni modifié — la cérémonie <em>lit</em> des points déjà
            settlés. La bascule est donc <strong className="text-white">réversible</strong> à tout moment.
          </span>
        </p>
      </div>

      <Link
        href="/final"
        className="inline-flex items-center gap-1.5 text-sm text-canal-yellow hover:underline mb-6"
      >
        Prévisualiser le palmarès <ExternalLink className="w-3.5 h-3.5" />
      </Link>

      {status !== null && (
        <div className="space-y-3">
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className={`w-full py-3 rounded-xl font-bold transition-colors ${
                isClosed
                  ? "bg-canal-green text-white hover:opacity-90"
                  : "bg-canal-red text-white hover:opacity-90"
              }`}
            >
              {isClosed ? "Rouvrir la compétition" : "Clôturer la Canal Cup 2026"}
            </button>
          ) : (
            <div className="canal-card border-canal-yellow space-y-3">
              <p className="text-sm font-bold text-white">
                {isClosed
                  ? "Rouvrir la compétition ? Les joueurs pourront de nouveau écrire."
                  : "Clôturer définitivement ? Plus aucun joueur ne pourra pronostiquer, répondre au quiz ou jouer un joker."}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => apply(isClosed ? "open" : "closed")}
                  className="flex-1 py-2.5 rounded-lg bg-canal-yellow text-canal-black font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmer
                </button>
                <button
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                  className="flex-1 py-2.5 rounded-lg bg-canal-gray-mid text-white font-semibold disabled:opacity-60"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
