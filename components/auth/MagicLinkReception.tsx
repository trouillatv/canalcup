"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Tab = "login" | "signup";
type Status = "idle" | "loading" | "error" | "sent";

const ERROR_LABELS: Record<string, string> = {
  auth_failed: "Lien invalide ou expiré. Connecte-toi ci-dessous.",
  not_allowed: "Cet email n'est pas autorisé. Contacte un admin.",
};

export function MagicLinkReception() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setErrorMsg(ERROR_LABELS[err] ?? "Une erreur est survenue.");
  }, []);

  const reset = () => { setStatus("idle"); setErrorMsg(""); setPassword(""); setConfirm(""); };

  const checkAllowlistAndRedirect = async () => {
    // Délégué à un endpoint server-side qui gère 3 cas :
    //   - déjà dans allowlist_users (active) → OK
    //   - email sur un domaine auto-autorisé (ex. canal-plus.com) →
    //     auto-insertion + OK (pas besoin d'intervention admin)
    //   - sinon → 403 not_allowed
    let payload: { ok?: boolean; error?: string; reason?: string } = {};
    try {
      const res = await fetch("/api/auth/self-allowlist", {
        method: "POST",
        credentials: "same-origin",
      });
      payload = await res.json().catch(() => ({}));
    } catch {
      /* ignoré → on traite comme not_allowed */
    }

    if (!payload?.ok) {
      const supabase = createClient();
      await supabase.auth.signOut();
      const reason = payload?.reason;
      const msg =
        payload?.error === "disabled"
          ? "Ton compte a été désactivé. Contacte un admin."
          : reason ?? "Cet email n'est pas autorisé. Contacte un admin.";
      setErrorMsg(msg);
      setStatus("error");
      return;
    }

    router.push("/");
    router.refresh();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setStatus("loading");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("error");
      setErrorMsg(
        error.message.includes("Invalid login")
          ? "Email ou mot de passe incorrect."
          : error.message
      );
      return;
    }

    await checkAllowlistAndRedirect();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirm) return;
    if (password !== confirm) { setErrorMsg("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setErrorMsg("Le mot de passe doit faire au moins 8 caractères."); return; }
    setStatus("loading");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setStatus("error");
      setErrorMsg(
        error.message.includes("already registered")
          ? "Ce compte existe déjà. Connecte-toi."
          : error.message
      );
      return;
    }

    await checkAllowlistAndRedirect();
  };

  const handleForgot = async () => {
    if (!email) { setErrorMsg("Entre d'abord ton email."); return; }
    setForgotSent(false);
    const supabase = createClient();
    const resetUrl = `${window.location.origin}/auth/reset-password`;
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
    setForgotSent(true);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "radial-gradient(ellipse at 50% -5%, #2A1E08 0%, #0D0B08 70%)" }}
    >
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-canal-yellow font-black text-5xl tracking-tight">CANAL</span>
            <span className="text-white font-black text-5xl tracking-tight">CUP</span>
          </div>
          <p className="text-canal-yellow/60 font-bold tracking-[0.3em] text-sm">2026</p>
        </div>

        {/* Card */}
        <div className="bg-canal-gray rounded-2xl border border-canal-gray-light overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-canal-gray-light">
            <button
              onClick={() => { setTab("login"); reset(); }}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
                tab === "login"
                  ? "text-canal-yellow border-b-2 border-canal-yellow bg-canal-yellow/5"
                  : "text-canal-gray-muted hover:text-white"
              }`}
            >
              Se connecter
            </button>
            <button
              onClick={() => { setTab("signup"); reset(); }}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
                tab === "signup"
                  ? "text-canal-yellow border-b-2 border-canal-yellow bg-canal-yellow/5"
                  : "text-canal-gray-muted hover:text-white"
              }`}
            >
              Créer un compte
            </button>
          </div>

          <div className="p-6">
            {tab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs text-canal-gray-muted mb-1.5 block font-bold uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom.nom@canal-plus.com"
                    required
                    autoFocus
                    className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-canal-gray-muted mb-1.5 block font-bold uppercase tracking-wider">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 pr-11 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-gray-muted hover:text-white transition-colors">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
                {forgotSent && <p className="text-green-400 text-sm">Lien envoyé sur {email} !</p>}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full py-3.5 bg-canal-yellow text-canal-black font-black text-base rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-50"
                >
                  {status === "loading" ? "Connexion…" : "Se connecter"}
                </button>

                <button
                  type="button"
                  onClick={handleForgot}
                  className="w-full text-canal-gray-muted text-xs hover:text-white transition-colors text-center"
                >
                  Mot de passe oublié ? Recevoir un lien de connexion
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="text-xs text-canal-gray-muted mb-1.5 block font-bold uppercase tracking-wider">Email Canal+</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom.nom@canal-plus.com"
                    required
                    autoFocus
                    className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-canal-gray-muted mb-1.5 block font-bold uppercase tracking-wider">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8 caractères minimum"
                      required
                      className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 pr-11 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-gray-muted hover:text-white transition-colors">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-canal-gray-muted mb-1.5 block font-bold uppercase tracking-wider">Confirmer</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 pr-11 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-gray-muted hover:text-white transition-colors">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full py-3.5 bg-canal-yellow text-canal-black font-black text-base rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-50"
                >
                  {status === "loading" ? "Création…" : "Créer mon compte"}
                </button>

                <p className="text-canal-gray-muted text-xs text-center">
                  Accès réservé aux participants Canal Cup.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
