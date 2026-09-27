"use client";

// Bulle de feedback flottante (côté utilisateur / testeur). Permet d'écrire en
// un clic ce qui ne va pas ; le message part dans la table feedback, consultée
// par l'admin (/admin/feedback). Un texte d'intro explique clairement le but.
//
// Masquée sur les écrans "kiosque" (TV, quiz-show) où il n'y a pas d'utilisateur
// individuel devant l'écran.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, X, Send } from "lucide-react";

type Status = "idle" | "sending" | "sent" | "error";

// "/cs" masqué : cette bulle référence Canal Cup dans son texte d'intro
// (ligne ~96) et n'a pas encore d'équivalent CANAL Sports (hors périmètre
// du sweep de rebranding, voir AUDIT-CANAL-SPORTS.md).
const HIDDEN_PREFIXES = ["/tv", "/quiz-show", "/cs"];

export function FloatingFeedback() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const submit = async () => {
    if (message.trim().length < 3) {
      setError("Écris au moins quelques mots 🙂");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), page: pathname }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Erreur");
      }
      setStatus("sent");
      setMessage("");
      setTimeout(() => { setOpen(false); setStatus("idle"); }, 1800);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Erreur réseau");
    }
  };

  return (
    <>
      {/* Bouton bulle — placé au-dessus de la BottomNav */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-3 z-40 flex items-center justify-center w-9 h-9 rounded-full bg-canal-yellow/90 text-canal-black shadow-md shadow-black/30 hover:bg-canal-yellow transition-colors"
          aria-label="Un souci ? Envoyer un feedback"
          title="Un souci ? Envoie-nous un feedback"
        >
          <span className="text-base leading-none">💬</span>
        </button>
      )}

      {/* Panneau */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md bg-canal-gray border border-canal-gray-light rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-4 border-b border-canal-gray-light">
              <div>
                <p className="font-black text-white text-base flex items-center gap-2">
                  <MessageSquarePlus size={18} className="text-canal-yellow" /> Un souci ? Une idée ?
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-canal-gray-muted hover:text-white" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            {status === "sent" ? (
              <div className="p-6 text-center space-y-2">
                <div className="text-4xl">🙌</div>
                <p className="text-white font-bold">Merci, c&apos;est envoyé !</p>
                <p className="text-canal-gray-muted text-sm">Ton retour est arrivé à l&apos;équipe.</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {/* Explication — à quoi sert cette bulle */}
                <div className="bg-canal-gray-mid rounded-xl p-3 text-xs text-canal-gray-muted leading-relaxed">
                  Tu testes Canal Cup en avant-première 🧪. Si quelque chose ne
                  marche pas, te semble bizarre, ou pourrait être mieux,{" "}
                  <span className="text-white font-bold">écris-le ici</span> : ça
                  part directement à l&apos;équipe. Ce n&apos;est pas un chat — on
                  ne répond pas en direct, mais on lit tout. Dis-nous ce que tu
                  faisais et ce qui cloche.
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  autoFocus
                  placeholder="Ex : sur la page Pronostics, le bouton Valider ne fait rien sur mon iPhone…"
                  className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-canal-gray-muted focus:outline-none focus:border-canal-yellow transition-colors resize-none"
                />

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  onClick={submit}
                  disabled={status === "sending"}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-50"
                >
                  {status === "sending" ? "Envoi…" : <><Send size={15} /> Envoyer à l&apos;équipe</>}
                </button>
                <p className="text-[11px] text-canal-gray-muted text-center">
                  Ton pseudo et la page actuelle sont joints automatiquement.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
