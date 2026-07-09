"use client";

// 🏓 Splash « demande de partenaire » — à l'ouverture de l'app, si quelqu'un
// m'a proposé de jouer au tournoi Baby-foot, un écran plein cadre me demande
// d'accepter ou refuser (règle produit : cet écran PRIME sur l'annonce
// événementielle). Un seul fetch léger au montage (?pending=1), pas de polling.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Incoming { id: string; fromName: string; }

export function PartnerRequestSplash() {
  const router = useRouter();
  const [req, setReq] = useState<Incoming | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/babyfoot/partner?pending=1", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.incoming && d?.registrationOpen) setReq(d.incoming); })
      .catch(() => {});
  }, []);

  if (!req) return null;

  const act = async (action: "accept" | "refuse") => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/babyfoot/partner", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action, request_id: req.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Action impossible."); setBusy(false); return; }
      if (action === "accept") setAccepted(true);
      else setReq(null);
    } catch { setError("Erreur réseau."); }
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-4 select-none"
      style={{ background: "radial-gradient(ellipse at 50% -5%, #2A1E08 0%, #130F08 45%, #0A0906 100%)" }}
      role="dialog" aria-modal="true" aria-label="Demande de partenaire baby-foot"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-canal-yellow/30 bg-canal-gray/80 backdrop-blur p-6 sm:p-8 text-center shadow-2xl">
        {accepted ? (
          <>
            <div className="text-5xl mb-2">🎉</div>
            <h2 className="font-black text-2xl text-canal-yellow uppercase tracking-wide">Binôme créé !</h2>
            <p className="text-white/80 text-sm mt-3">
              Tu joues avec <b className="text-white">{req.fromName}</b> au tournoi Baby-foot.
              Dernière étape : <b className="text-white">choisissez vos créneaux</b>.
            </p>
            <button
              onClick={() => { setReq(null); router.push("/babyfoot/register"); }}
              className="mt-6 w-full py-3.5 rounded-2xl bg-canal-yellow text-canal-black font-black text-base shadow-lg active:scale-[0.98] transition-transform"
            >
              🗓️ Choisir nos créneaux
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl mb-2">🏓</div>
            <h2 className="font-black text-2xl text-canal-yellow uppercase tracking-wide">Demande de partenaire</h2>
            <p className="text-white text-lg font-bold mt-4"><span className="text-canal-yellow">{req.fromName}</span> souhaite jouer avec toi au tournoi Baby-foot !</p>
            {error && <p className="text-red-400 text-sm font-bold mt-3">{error}</p>}
            <div className="mt-6 flex flex-col gap-2.5">
              <button disabled={busy} onClick={() => act("accept")}
                className="w-full py-3.5 rounded-2xl bg-canal-yellow text-canal-black font-black text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50">
                ✅ J&apos;accepte
              </button>
              <button disabled={busy} onClick={() => act("refuse")}
                className="w-full py-3 rounded-2xl bg-white/5 border border-white/15 text-white font-bold text-sm hover:bg-white/10 transition-colors disabled:opacity-50">
                ❌ Je refuse
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
