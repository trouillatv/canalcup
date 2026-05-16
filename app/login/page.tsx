"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, CheckCircle, AlertCircle, FlaskConical } from "lucide-react";

const IS_DEV = process.env.NODE_ENV === "development";

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Lien invalide ou expiré. Réessayez.",
  not_allowed: "Cet email n'est pas autorisé à accéder à Canal Cup.",
  unauthorized: "Accès refusé — vous n'avez pas les droits suffisants.",
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  const errorKey = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    errorKey ? (ERROR_MESSAGES[errorKey] ?? "Une erreur est survenue.") : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg(null);

    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`;

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

  if (status === "sent") {
    return (
      <div className="min-h-screen bg-canal-black flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <CheckCircle size={48} className="text-canal-yellow mx-auto" />
          <h2 className="canal-headline text-2xl">Vérifiez votre email</h2>
          <p className="text-canal-gray-muted">
            Un lien de connexion a été envoyé à <strong className="text-white">{email}</strong>.
          </p>
          <p className="text-canal-gray-muted text-sm">
            Cliquez sur le lien dans l'email pour vous connecter. Le lien expire dans 1 heure.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="text-canal-yellow text-sm underline"
          >
            Utiliser un autre email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canal-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-canal-yellow font-black text-4xl tracking-tight">CANAL</span>
            <span className="text-white font-black text-4xl tracking-tight">CUP</span>
          </div>
          <p className="text-canal-yellow font-bold tracking-widest text-sm">2026</p>
          <p className="text-canal-gray-muted text-sm mt-3">
            Tournoi interne Canal+ — Coupe du Monde
          </p>
        </div>

        {/* Erreur */}
        {errorMsg && (
          <div className="flex items-start gap-2 bg-red-950/40 border border-red-900/50 rounded-xl p-3">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{errorMsg}</p>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-canal-gray-muted mb-2 block font-bold uppercase tracking-wider">
              Votre email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-canal-gray-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@canal-plus.com"
                required
                className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl pl-9 pr-4 py-3 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={status === "loading" || !email}
            className="w-full py-3.5 bg-canal-yellow text-canal-black font-black text-base rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-50"
          >
            {status === "loading" ? "Envoi en cours…" : "Recevoir le lien de connexion"}
          </button>
        </form>

        <p className="text-center text-canal-gray-muted text-xs">
          Accès réservé aux participants Canal Cup.
          <br />
          Votre email doit être dans la liste autorisée.
        </p>

        {/* Bypass dev — jamais affiché en production */}
        {IS_DEV && (
          <div className="border border-dashed border-canal-gray-light rounded-xl p-4 space-y-3">
            <p className="text-xs text-canal-gray-muted flex items-center gap-1.5">
              <FlaskConical size={12} /> Mode dev — lien direct (sans email)
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-canal-gray border border-canal-gray-light rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-canal-gray-muted"
              />
              <button
                onClick={async () => {
                  if (!email) return;
                  const res = await fetch("/api/dev/magic-link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                  });
                  const data = await res.json();
                  if (data.link) setDevLink(data.link);
                  else setDevLink("Erreur : " + data.error);
                }}
                className="px-3 py-1.5 bg-canal-gray-mid border border-canal-gray-light rounded-lg text-xs text-white font-bold hover:bg-canal-gray-light"
              >
                Générer
              </button>
            </div>
            {devLink && (
              <a
                href={devLink}
                className="block text-xs text-canal-yellow underline break-all leading-relaxed"
              >
                → Cliquer ici pour se connecter
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
