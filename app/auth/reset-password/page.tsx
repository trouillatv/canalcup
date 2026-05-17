"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function initSession() {
      // PKCE flow: code in query params
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) { setSessionReady(true); return; }
      }

      // Implicit flow: tokens in hash fragment
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!error) { setSessionReady(true); return; }
      }

      // May already have a recovery session
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setSessionReady(true);
      else setErrorMsg("Lien invalide ou expiré. Demande un nouveau lien.");
    }

    initSession();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setErrorMsg("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setErrorMsg("8 caractères minimum."); return; }
    setStatus("loading");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }

    setStatus("done");
    setTimeout(() => router.push("/"), 1500);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "radial-gradient(ellipse at 50% -5%, #2A1E08 0%, #0D0B08 70%)" }}
    >
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-canal-yellow font-black text-4xl tracking-tight">CANAL</span>
            <span className="text-white font-black text-4xl tracking-tight">CUP</span>
          </div>
          <p className="text-canal-yellow/60 font-bold tracking-[0.3em] text-sm">2026</p>
        </div>

        <div className="bg-canal-gray rounded-2xl border border-canal-gray-light p-6 space-y-5">
          <div>
            <h1 className="text-white font-black text-xl">Nouveau mot de passe</h1>
            <p className="text-canal-gray-muted text-sm mt-1">Choisis un mot de passe pour ton compte Canal Cup.</p>
          </div>

          {status === "done" ? (
            <div className="text-center py-4 space-y-2">
              <span className="text-4xl block">✅</span>
              <p className="text-white font-bold">Mot de passe mis à jour !</p>
              <p className="text-canal-gray-muted text-sm">Redirection en cours…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-canal-gray-muted mb-1.5 block font-bold uppercase tracking-wider">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8 caractères minimum"
                    required
                    autoFocus
                    disabled={!sessionReady}
                    className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 pr-11 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors disabled:opacity-40"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} disabled={!sessionReady} className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-gray-muted hover:text-white transition-colors disabled:opacity-40">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-canal-gray-muted mb-1.5 block font-bold uppercase tracking-wider">
                  Confirmer
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={!sessionReady}
                    className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 pr-11 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors disabled:opacity-40"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} disabled={!sessionReady} className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-gray-muted hover:text-white transition-colors disabled:opacity-40">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

              <button
                type="submit"
                disabled={status === "loading" || !sessionReady}
                className="w-full py-3.5 bg-canal-yellow text-canal-black font-black text-base rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-50"
              >
                {status === "loading" ? "Mise à jour…" : "Enregistrer le mot de passe"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canal-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
