"use client";

// /admin/qr — affiche le QR code à imprimer/projeter pour amener les
// gens sur /p/welcome, et le compteur de scans (rafraîchi toutes 5s).
//
// Génération du QR : on utilise api.qrserver.com (service public,
// gratuit, pas de clé). L'URL pointe vers ${APP_URL}/p/welcome. Si
// NEXT_PUBLIC_APP_URL n'est pas défini, fallback sur window.location.origin.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { QrCode, ExternalLink, RefreshCw, Share2, Check } from "lucide-react";

interface Counter {
  slug: string;
  count: number;
  last_scan_at: string | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminQrPage() {
  const [counter, setCounter] = useState<Counter | null>(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState<string>("");
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied">("idle");

  useEffect(() => {
    setOrigin(
      process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "")
    );
  }, []);

  const fetchCounter = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/qr?slug=welcome", { credentials: "same-origin" });
      if (!res.ok) return;
      const d: Counter = await res.json();
      setCounter(d);
    } catch {
      /* silencieux */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCounter();
    const t = setInterval(fetchCounter, 5000);
    return () => clearInterval(t);
  }, [fetchCounter]);

  const targetUrl = origin ? `${origin}/p/welcome` : "";
  const qrImageUrl = targetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=20&data=${encodeURIComponent(targetUrl)}`
    : "";

  // Partager : on tente d'abord de partager le PNG du QR (utile sur mobile
  // pour l'envoyer dans WhatsApp avec l'aperçu visuel). Si l'API Web Share
  // ne supporte pas les fichiers (desktop, vieux navigateurs), on retombe
  // sur le partage d'URL. Dernier filet : copie dans le presse-papier.
  const handleShare = async () => {
    if (!targetUrl || shareState === "sharing") return;
    setShareState("sharing");
    const shareData: ShareData = {
      title: "Canal Cup — Calendrier WC2026",
      text: "Scanne le QR ou ouvre ce lien pour le calendrier complet de la Coupe du Monde 2026.",
      url: targetUrl,
    };
    try {
      // Tentative 1 : partager l'image du QR comme fichier (mobile uniquement).
      if (qrImageUrl && typeof navigator !== "undefined" && "share" in navigator) {
        try {
          const res = await fetch(qrImageUrl);
          if (res.ok) {
            const blob = await res.blob();
            const file = new File([blob], "canalcup-qr-welcome.png", { type: blob.type || "image/png" });
            const withFile: ShareData = { ...shareData, files: [file] };
            // canShare retourne false sur desktop / si type non supporté → on tombe sur le else.
            if (navigator.canShare && navigator.canShare(withFile)) {
              await navigator.share(withFile);
              setShareState("idle");
              return;
            }
          }
        } catch {
          /* on retombera sur le partage d'URL */
        }
      }
      // Tentative 2 : partage d'URL.
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share(shareData);
        setShareState("idle");
        return;
      }
      // Tentative 3 : copie dans le presse-papier. Cast nécessaire car TS
      // a narrow navigator à `never` après les checks "share" in navigator.
      const clip = (typeof navigator !== "undefined" ? (navigator as Navigator).clipboard : undefined);
      if (clip) {
        await clip.writeText(targetUrl);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2500);
        return;
      }
      setShareState("idle");
    } catch {
      // L'utilisateur a annulé le sheet de partage → pas une erreur.
      setShareState("idle");
    }
  };

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="canal-headline text-2xl flex items-center gap-2">
          <QrCode size={22} /> QR Code — Affiche WC2026
        </h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Imprime / projette ce QR. Quand quelqu&apos;un le scanne, il atterrit sur{" "}
          <Link
            href="/p/welcome"
            target="_blank"
            className="text-canal-yellow underline inline-flex items-center gap-1"
          >
            /p/welcome <ExternalLink size={11} />
          </Link>{" "}
          et voit le calendrier.
        </p>
      </div>

      <section className="canal-card flex flex-col items-center gap-3">
        {qrImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrImageUrl}
            alt={`QR code vers ${targetUrl}`}
            width={300}
            height={300}
            className="rounded-xl bg-white p-3"
          />
        ) : (
          <div className="w-[300px] h-[300px] flex items-center justify-center text-canal-gray-muted text-xs">
            Chargement…
          </div>
        )}
        <div className="text-center">
          <p className="text-xs text-canal-gray-muted">URL encodée :</p>
          <p className="text-sm text-white font-mono break-all">
            {targetUrl || "(en attente)"}
          </p>
        </div>
        {qrImageUrl && (
          <a
            href={qrImageUrl}
            download="canalcup-qr-welcome.png"
            className="text-xs text-canal-yellow underline mt-1"
          >
            Télécharger le QR en PNG haute déf
          </a>
        )}

        {/* Partager — Web Share API natif (sheet iOS/Android) avec fallback
            copie URL si non supporté. Bouton plein largeur sous le QR. */}
        <button
          onClick={handleShare}
          disabled={!targetUrl || shareState === "sharing"}
          className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-40"
        >
          {shareState === "copied" ? (
            <>
              <Check size={16} /> Lien copié !
            </>
          ) : (
            <>
              <Share2 size={16} />
              {shareState === "sharing" ? "Partage…" : "Partager le QR"}
            </>
          )}
        </button>
        <p className="text-[11px] text-canal-gray-muted italic text-center">
          Sur mobile : ouvre le sheet WhatsApp / SMS / Mail avec le QR en
          pièce jointe. Sur desktop : copie le lien dans le presse-papier.
        </p>
      </section>

      <section className="canal-card space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-canal-yellow font-bold uppercase text-xs tracking-wider">
            Scans
          </p>
          <button
            onClick={fetchCounter}
            className="flex items-center gap-1 text-canal-gray-muted hover:text-white transition-colors text-xs"
            aria-label="Rafraîchir"
          >
            <RefreshCw size={12} /> Rafraîchir
          </button>
        </div>
        {loading ? (
          <p className="text-canal-gray-muted text-sm">Chargement…</p>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-canal-yellow font-black text-5xl tabular-nums">
              {counter?.count ?? 0}
            </span>
            <span className="text-canal-gray-muted text-sm">
              ouverture{(counter?.count ?? 0) > 1 ? "s" : ""} de la page
            </span>
          </div>
        )}
        <p className="text-xs text-canal-gray-muted">
          Dernier scan : <span className="text-white">{formatTime(counter?.last_scan_at ?? null)}</span>
        </p>
        <p className="text-[11px] text-canal-gray-muted italic pt-1">
          Note : chaque ouverture de page compte (un refresh = +1). Pas de
          déduplication par utilisateur — donne un ordre de grandeur, pas un
          compte unique.
        </p>
      </section>
    </div>
  );
}
