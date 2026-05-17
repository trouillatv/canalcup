"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "loading" | "sent" | "error";

export function MagicLinkReception() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");

    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  };

  // ─── Confirmation envoyée ────────────────────────────────────────────────

  if (status === "sent") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-8 text-center"
        style={{ background: "radial-gradient(ellipse at 50% -5%, #2A1E08 0%, #0D0B08 70%)" }}>
        <div className="space-y-6 max-w-xs">
          <span className="text-6xl block">📬</span>
          <div>
            <p className="font-black text-white text-2xl mb-2">Vérifie ta boîte mail</p>
            <p className="text-canal-gray-muted leading-relaxed">
              Un lien de connexion a été envoyé à{" "}
              <span className="text-canal-yellow font-bold">{email}</span>.
            </p>
            <p className="text-canal-gray-muted text-sm mt-3">
              Clique sur le lien pour accéder au tournoi. Il expire dans 1 heure.
            </p>
          </div>
          <button
            onClick={() => setStatus("idle")}
            className="text-canal-gray-muted text-sm underline hover:text-white transition-colors"
          >
            Utiliser un autre email
          </button>
        </div>
      </div>
    );
  }

  // ─── Formulaire de réception ─────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-8"
      style={{ background: "radial-gradient(ellipse at 50% -5%, #2A1E08 0%, #0D0B08 70%)" }}
    >
      <div className="w-full max-w-sm space-y-10">

        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="text-canal-yellow font-black text-5xl tracking-tight">CANAL</span>
            <span className="text-white font-black text-5xl tracking-tight">CUP</span>
          </div>
          <p className="text-canal-yellow/60 font-bold tracking-[0.3em] text-sm">2026</p>
          <p className="text-canal-gray-muted text-sm pt-2">
            Tournoi interne Canal+ · Coupe du Monde
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-canal-gray-muted mb-2 block font-bold uppercase tracking-wider">
              Ton email Canal+
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@canal-plus.com"
              required
              autoFocus
              className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3.5 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors"
            />
          </div>

          {status === "error" && (
            <p className="text-red-400 text-sm">{errorMsg || "Erreur — réessaie."}</p>
          )}

          <button
            type="submit"
            disabled={status === "loading" || !email}
            className="w-full py-4 bg-canal-yellow text-canal-black font-black text-base rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-50 shadow-[0_0_30px_rgba(255,215,0,0.25)]"
          >
            {status === "loading" ? "Envoi…" : "Recevoir mon lien de connexion"}
          </button>
        </form>

        <p className="text-center text-canal-gray-muted text-xs leading-relaxed">
          Accès réservé aux participants Canal Cup.
          <br />
          Ton email doit être dans la liste autorisée.
        </p>
      </div>
    </div>
  );
}
