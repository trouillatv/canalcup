"use client";

// /admin/babyfoot/qr — le QR à afficher / projeter / partager pour que les gens
// REJOIGNENT une équipe et s'inscrivent au tournoi baby-foot. Quand quelqu'un le
// scanne, il atterrit sur /babyfoot/register : s'il n'a pas encore d'équipe, la
// page l'invite à en créer / rejoindre une (binôme, max 2) ; s'il en a une, il
// inscrit son binôme au tournoi.
//
// Même mécanique que /admin/qr (welcome) : génération via api.qrserver.com
// (service public, gratuit, sans clé). L'URL cible se résout à l'exécution via
// NEXT_PUBLIC_APP_URL, sinon window.location.origin — donc le QR pointe toujours
// vers le bon domaine, y compris en prod.

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode, ExternalLink, Share2, Check, Download, Printer, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function AdminBabyfootQrPage() {
  const [origin, setOrigin] = useState<string>("");
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied">("idle");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setOrigin(
      process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "")
    );
  }, []);

  const targetUrl = origin ? `${origin}/babyfoot/register` : "";
  const qrImageUrl = targetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=20&data=${encodeURIComponent(targetUrl)}`
    : "";
  // Version haute déf pour l'impression (1200x1200), récupérée à la demande.
  const qrPrintUrl = targetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&margin=30&format=png&data=${encodeURIComponent(targetUrl)}`
    : "";

  // Téléchargement vrai : on fetch l'image cross-origin, on crée un Blob + object
  // URL local, puis on déclenche <a download>. Le navigateur ignore `download`
  // sur les <a href> cross-origin, d'où ce détour. api.qrserver.com supporte CORS.
  const handleDownload = async () => {
    if (!qrPrintUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(qrPrintUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "canalcup-qr-babyfoot.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      // Fallback : ouvrir l'URL dans un onglet, clic droit → enregistrer l'image.
      window.open(qrPrintUrl, "_blank", "noopener");
      console.warn("[qr babyfoot download fallback]", e);
    }
    setDownloading(false);
  };

  // Partager : on tente d'abord de partager le PNG du QR (utile sur mobile pour
  // l'envoyer dans WhatsApp avec l'aperçu). Si Web Share ne supporte pas les
  // fichiers (desktop), on retombe sur le partage d'URL, puis sur la copie.
  const handleShare = async () => {
    if (!targetUrl || shareState === "sharing") return;
    setShareState("sharing");
    const shareData: ShareData = {
      title: "Tournoi Baby-foot CanalCup",
      text: "Scanne le QR ou ouvre ce lien pour former ton binôme et t'inscrire au tournoi baby-foot CanalCup !",
      url: targetUrl,
    };
    try {
      // Tentative 1 : partager l'image du QR comme fichier (mobile).
      if (qrImageUrl && typeof navigator !== "undefined" && "share" in navigator) {
        try {
          const res = await fetch(qrImageUrl);
          if (res.ok) {
            const blob = await res.blob();
            const file = new File([blob], "canalcup-qr-babyfoot.png", { type: blob.type || "image/png" });
            const withFile: ShareData = { ...shareData, files: [file] };
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
      // Tentative 3 : copie dans le presse-papier.
      const clip = typeof navigator !== "undefined" ? (navigator as Navigator).clipboard : undefined;
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
          <QrCode size={22} /> QR Code — Rejoindre une équipe Baby-foot
        </h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Imprime / projette / partage ce QR. Quand quelqu&apos;un le scanne, il
          atterrit sur{" "}
          <Link
            href="/babyfoot/register"
            target="_blank"
            className="text-canal-yellow underline inline-flex items-center gap-1"
          >
            /babyfoot/register <ExternalLink size={11} />
          </Link>
          . S&apos;il n&apos;a pas encore d&apos;équipe, la page l&apos;invite à
          en créer / rejoindre une (binôme, 2 joueurs) ; sinon il inscrit son
          binôme au tournoi.
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

        {qrPrintUrl && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            onClick={handleDownload}
            loading={downloading}
            loadingText="Téléchargement…"
            leftIcon={<Download size={14} />}
          >
            Télécharger le QR (PNG 1200×1200)
          </Button>
        )}

        {/* Partager — Web Share API natif (sheet iOS/Android) avec fallback copie. */}
        <button
          onClick={handleShare}
          disabled={!targetUrl || shareState === "sharing"}
          className="w-full flex items-center justify-center gap-2 py-3 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-40"
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
          Sur mobile : ouvre le sheet WhatsApp / SMS / Mail avec le QR en pièce
          jointe. Sur desktop : copie le lien dans le presse-papier.
        </p>
      </section>

      {/* Affiches A3 prêtes à imprimer (QR intégré, plein format). */}
      <section className="canal-card space-y-2">
        <p className="text-canal-yellow font-bold uppercase text-xs tracking-wider flex items-center gap-1.5">
          <Printer size={13} /> Affiches A3 (QR intégré)
        </p>
        <p className="text-xs text-canal-gray-muted">
          Versions imprimables plein format à laisser au mur toute la période
          d&apos;inscription.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href="/p/babyfoot/1"
            target="_blank"
            rel="noopener"
            className="px-3 py-2 rounded-lg bg-canal-gray-mid text-white text-sm font-bold border border-canal-gray-light inline-flex items-center gap-1.5"
          >
            « Formez votre binôme » <ExternalLink size={12} />
          </a>
          <a
            href="/p/babyfoot/2"
            target="_blank"
            rel="noopener"
            className="px-3 py-2 rounded-lg bg-canal-gray-mid text-white text-sm font-bold border border-canal-gray-light inline-flex items-center gap-1.5"
          >
            « Qui sera champion ? » <ExternalLink size={12} />
          </a>
        </div>
      </section>

      <div className="flex items-center justify-between text-xs">
        <Link href="/admin/babyfoot" className="text-canal-yellow underline inline-flex items-center gap-1">
          ← Retour à l&apos;organisation du tournoi
        </Link>
        <Link href="/babyfoot/register" target="_blank" className="text-canal-gray-muted hover:text-white inline-flex items-center gap-1">
          <Users size={12} /> Voir la page d&apos;inscription
        </Link>
      </div>
    </div>
  );
}
