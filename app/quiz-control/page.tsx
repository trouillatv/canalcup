"use client";

// 🎤 Télécommande PRÉSENTATEUR (Marie). Pilote le rythme du quiz depuis un
// téléphone : un seul gros bouton contextuel fait avancer l'étape sur le grand
// écran (countdown → question → timeup → stats → answer → leaderboard → suivante).
//
// Accès par PIN TV (comme /quiz-show). Les actions passent par
// /api/admin/quiz/session (x-admin-secret), comme le panneau /admin/quiz.

import React, { useState, useEffect, useCallback, useRef } from "react";

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";
const POLL_MS = 1000;
const WARM_BG = "radial-gradient(ellipse at 50% -5%, #2A1E08 0%, #130F08 45%, #0A0906 100%)";

type Phase = "countdown" | "question" | "timeup" | "stats" | "answer" | "leaderboard";
interface State {
  status: "idle" | "question" | "finished";
  phase?: Phase;
  question?: { question: string };
  question_index?: number;
  total?: number;
  responded?: number;
  participants?: number;
}

const PHASE_LABEL: Record<string, string> = {
  countdown: "Préparation…",
  question: "Question en cours",
  timeup: "Temps écoulé",
  stats: "Répartition affichée",
  answer: "Réponse affichée",
  leaderboard: "Classement affiché",
};

// Bouton principal selon l'état courant.
function primary(s: State): { label: string; action: string; disabled?: boolean } {
  if (s.status === "idle") return { label: "▶️  Démarrer le quiz", action: "start" };
  if (s.status === "finished") return { label: "🔁  Relancer un quiz", action: "start" };
  switch (s.phase) {
    case "countdown":
      return { label: "⏳  Lancement…", action: "advance", disabled: true };
    case "question":
      return { label: "👁  Révéler maintenant", action: "advance" };
    case "timeup":
      return { label: "📊  Révéler les votes", action: "advance" };
    case "stats":
      return { label: "✅  Montrer la réponse", action: "advance" };
    case "answer":
      return { label: "🏆  Voir le classement", action: "advance" };
    case "leaderboard":
      return { label: "➡️  Question suivante", action: "advance" };
    default:
      return { label: "▶️  Démarrer", action: "start" };
  }
}

function PinGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const pin = new URLSearchParams(window.location.search).get("pin") ?? "";
    fetch(`/api/tv/auth?pin=${encodeURIComponent(pin)}`).then((r) => setOk(r.ok)).catch(() => setOk(false));
  }, []);
  if (ok === null)
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: WARM_BG }}>
        <div className="w-9 h-9 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!ok)
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: WARM_BG }}>
        <p className="text-canal-yellow font-black text-3xl">TÉLÉCOMMANDE QUIZ</p>
        <p className="text-white/60 text-lg">Accès réservé à l&apos;animateur.</p>
        <p className="text-white/40">Ajoutez <span className="text-canal-yellow font-mono">?pin=XXXX</span> à l&apos;URL.</p>
      </div>
    );
  return <>{children}</>;
}

export default function QuizControlPage() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/quiz/session", { credentials: "same-origin" });
      if (!r.ok) return;
      const d = await r.json();
      if (!cancelled.current) setState(d as State);
    } catch {
      /* silencieux */
    }
  }, []);

  useEffect(() => {
    cancelled.current = false;
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled.current = true;
      clearInterval(t);
    };
  }, [load]);

  const post = async (action: string) => {
    setBusy(true);
    try {
      await fetch("/api/admin/quiz/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ action }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const btn = primary(state);
  const active = state.status === "question";

  return (
    <PinGate>
      <div className="fixed inset-0 flex flex-col select-none" style={{ background: WARM_BG }}>
        {/* Header */}
        <div className="px-5 pt-6 pb-3 flex items-center justify-between">
          <span className="font-black text-xl text-canal-yellow">🎤 Télécommande</span>
          {active && state.total ? (
            <span className="text-white/60 font-bold tabular-nums">
              Q {(state.question_index ?? 0) + 1}/{state.total}
            </span>
          ) : null}
        </div>

        {/* Contexte */}
        <div className="flex-1 flex flex-col justify-center px-5 gap-5 min-h-0 overflow-y-auto">
          {active ? (
            <>
              <span className="self-start text-xs uppercase tracking-widest font-black text-canal-yellow/80 bg-canal-yellow/10 px-3 py-1 rounded-full">
                {PHASE_LABEL[state.phase ?? "question"] ?? state.phase}
              </span>
              <p className="text-white font-bold text-xl sm:text-3xl leading-snug">{state.question?.question}</p>
              {(state.phase === "stats" || state.phase === "answer" || state.phase === "leaderboard") && (
                <p className="text-white/50 text-sm">
                  {state.responded ?? 0} / {state.participants ?? 0} ont répondu
                </p>
              )}
            </>
          ) : state.status === "finished" ? (
            <div className="text-center">
              <p className="text-4xl mb-3">🏁</p>
              <p className="text-white font-black text-2xl">Quiz terminé</p>
              <p className="text-white/50 text-sm mt-2">Le classement final est à l&apos;écran.</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-5xl mb-3">🎬</p>
              <p className="text-white font-black text-2xl">Prêt à lancer</p>
              <p className="text-white/50 text-sm mt-2">Vérifie que le grand écran est ouvert (/quiz-show).</p>
            </div>
          )}
        </div>

        {/* Boutons */}
        <div className="px-5 pb-8 pt-3 space-y-3 border-t border-white/10">
          <button
            onClick={() => post(btn.action)}
            disabled={busy || btn.disabled}
            className="w-full py-5 rounded-2xl bg-canal-yellow text-canal-black font-black text-xl sm:text-2xl shadow-lg disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {busy ? "…" : btn.label}
          </button>
          <div className="flex gap-3">
            {active && (
              <button
                onClick={() => post("next")}
                disabled={busy}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white/80 font-bold text-sm disabled:opacity-40"
              >
                ⏭ Sauter la question
              </button>
            )}
            {state.status !== "idle" && (
              <button
                onClick={() => post("end")}
                disabled={busy}
                className="flex-1 py-3 rounded-xl bg-red-950/40 border border-red-900/40 text-red-300 font-bold text-sm disabled:opacity-40"
              >
                ⏹ Terminer le quiz
              </button>
            )}
          </div>
        </div>
      </div>
    </PinGate>
  );
}
