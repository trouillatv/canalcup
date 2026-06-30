"use client";

// Écran TV MAÎTRE du quiz (plateau télé). Recâblé sur la VRAIE session live :
// il poll /api/quiz/session (~1s) et reflète exactement ce que voient les
// téléphones (/quiz-live). L'animateur pilote depuis /admin/quiz (start/next).
//
// Phases (dérivées du temps serveur, sans dérive) :
//   countdown → "3 / 2 / 1"
//   question  → question + 4 réponses + chrono géant
//   reveal    → "Temps écoulé" → % de répondants → répartition A/B/C/D →
//               ✅ bonne réponse + explication
//
// Pas de Realtime (V1) : polling 1s, largement suffisant en salle.

import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { QUIZ_TIMER_SECONDS } from "@/lib/scoring";
import { sfx, initAudio } from "@/lib/quiz/sound";

const ANSWER_KEYS = ["A", "B", "C", "D"] as const;
const POLL_MS = 1000;

const ANSWER_PALETTE: Record<string, { bg: string; text: string; bar: string }> = {
  A: { bg: "bg-canal-yellow", text: "text-canal-black", bar: "bg-canal-yellow" },
  B: { bg: "bg-blue-600", text: "text-white", bar: "bg-blue-500" },
  C: { bg: "bg-violet-600", text: "text-white", bar: "bg-violet-500" },
  D: { bg: "bg-orange-500", text: "text-white", bar: "bg-orange-400" },
};

const CATEGORY_ICONS: Record<string, string> = { foot: "⚽", culture: "🌍", canal: "📺", general: "🎲" };
const DIFFICULTY_LABELS: Record<string, string> = { easy: "Facile", medium: "Moyen", hard: "Difficile" };
const DIFFICULTY_COLORS: Record<string, string> = { easy: "text-green-400", medium: "text-yellow-400", hard: "text-red-400" };

const WARM_BG = "radial-gradient(ellipse at 50% -5%, #2A1E08 0%, #130F08 45%, #0A0906 100%)";

interface SessionQuestion {
  id: string;
  question: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  category?: string;
  difficulty?: string;
}
interface LiveSession {
  status: "question";
  phase: "countdown" | "question" | "reveal";
  question: SessionQuestion;
  started_at: string;
  question_index: number;
  total: number;
  correct_answer?: string;
  explanation?: string;
  distribution?: Record<"A" | "B" | "C" | "D", number>;
  responded?: number;
  participants?: number;
  fastest?: { name: string; ms: number } | null;
}

// ─── PIN Gate ────────────────────────────────────────────────────────────────
function PinGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const pin = new URLSearchParams(window.location.search).get("pin") ?? "";
    fetch(`/api/tv/auth?pin=${encodeURIComponent(pin)}`).then((r) => setOk(r.ok)).catch(() => setOk(false));
  }, []);
  if (ok === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: WARM_BG }}>
        <div className="w-10 h-10 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!ok) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6" style={{ background: WARM_BG }}>
        <p className="text-canal-yellow font-black text-4xl">QUIZ CANAL CUP</p>
        <p className="text-white/60 text-2xl">Accès réservé à l&apos;animateur.</p>
        <p className="text-white/40 text-lg mt-2">
          Ajoutez <span className="text-canal-yellow font-mono">?pin=XXXX</span> à l&apos;URL.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function QuizShowPage() {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [idle, setIdle] = useState(true);
  const [, forceTick] = useState(0);
  const cancelled = useRef(false);

  // 🎬 Chorégraphie du reveal : un état interne 0→4 qui se déroule au fil de
  // timers, pour un rythme « émission télé ». La PHASE serveur reste "reveal".
  //   0 = Temps écoulé · 1 = % de répondants · 2 = barres · 3 = bonne réponse
  //   4 = explication + stats (le plus rapide, « personne n'a trouvé »…)
  const [revealStage, setRevealStage] = useState(0);
  const revealForQ = useRef<string | null>(null);
  const phase = session?.phase;
  const currentQId = session?.question.id ?? null;
  useEffect(() => {
    if (phase !== "reveal" || !currentQId) {
      revealForQ.current = null;
      setRevealStage(0);
      return;
    }
    if (revealForQ.current === currentQId) return; // séquence déjà lancée
    revealForQ.current = currentQId;
    setRevealStage(0);
    if (soundOnRef.current) sfx.buzzer(); // fin du temps
    const timers = [
      setTimeout(() => setRevealStage(1), 800),
      setTimeout(() => { setRevealStage(2); if (soundOnRef.current) sfx.reveal(); }, 1800),
      setTimeout(() => { setRevealStage(3); if (soundOnRef.current) sfx.correct(); }, 3500),
      setTimeout(() => setRevealStage(4), 5000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase, currentQId]);

  // ── 🔊 Son (TV uniquement) ───────────────────────────────────────────────────
  const [soundOn, setSoundOn] = useState(false);
  const soundOnRef = useRef(false);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  const toggleSound = () => {
    if (!soundOn) {
      initAudio(); // débloque l'AudioContext (geste utilisateur obligatoire)
      sfx.whoosh();
      setSoundOn(true);
    } else {
      setSoundOn(false);
    }
  };

  // Whoosh au démarrage de chaque question (passage countdown → question).
  const whooshRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase === "countdown") whooshRef.current = null;
    if (phase === "question" && currentQId && whooshRef.current !== currentQId) {
      whooshRef.current = currentQId;
      if (soundOnRef.current) sfx.whoosh();
    }
  }, [phase, currentQId]);

  // Tics du compte à rebours : 3·2·1 (avant la question) puis 5·4·3·2·1 (chrono).
  const startedAt = session?.started_at;
  useEffect(() => {
    if (!startedAt) return;
    const startMs = new Date(startedAt).getTime();
    let lastSec = -1;
    const iv = setInterval(() => {
      const el = Date.now() - startMs;
      if (el < 0) {
        const left = Math.ceil(-el / 1000);
        if (left >= 1 && left <= 3 && left !== lastSec) {
          lastSec = left;
          if (soundOnRef.current) sfx.tick(3 - left);
        }
      } else if (el < QUIZ_TIMER_SECONDS * 1000) {
        const left = Math.ceil((QUIZ_TIMER_SECONDS * 1000 - el) / 1000);
        if (left >= 1 && left <= 5 && left !== lastSec) {
          lastSec = left;
          if (soundOnRef.current) sfx.tick(5 - left);
        }
      }
    }, 100);
    return () => clearInterval(iv);
  }, [startedAt]);

  // Bouton son flottant, présent sur tous les écrans.
  const soundBtn = (
    <button
      onClick={toggleSound}
      title={soundOn ? "Couper le son" : "Activer le son"}
      className="fixed top-3 right-3 sm:top-5 sm:right-5 z-50 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/40 border border-white/20 backdrop-blur flex items-center justify-center text-white/80 hover:text-white hover:border-canal-yellow/60 transition-colors"
    >
      {soundOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
    </button>
  );

  useEffect(() => {
    cancelled.current = false;
    const load = async () => {
      try {
        const res = await fetch("/api/quiz/session", { credentials: "same-origin" });
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled.current) return;
        if (d.status === "question" && d.question) {
          setSession(d as LiveSession);
          setIdle(false);
        } else {
          setSession(null);
          setIdle(true);
        }
      } catch {
        /* silencieux */
      }
    };
    load();
    const t = setInterval(load, POLL_MS);
    const tick = setInterval(() => forceTick((v) => v + 1), 250);
    return () => {
      cancelled.current = true;
      clearInterval(t);
      clearInterval(tick);
    };
  }, []);

  // ── Idle : en attente du lancement ─────────────────────────────────────────
  if (idle || !session) {
    return (
      <PinGate>
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 sm:gap-10 px-4 select-none" style={{ background: WARM_BG }}>
          <div className="relative flex flex-col items-center">
            <div className="absolute inset-0 -inset-x-20 bg-canal-yellow/10 rounded-full blur-3xl" />
            <span className="text-6xl sm:text-9xl relative">🏆</span>
          </div>
          <div className="text-center space-y-2">
            <p className="font-black text-4xl sm:text-7xl text-canal-yellow uppercase tracking-widest">QUIZ</p>
            <p className="font-black text-2xl sm:text-5xl text-white uppercase tracking-wide">CANAL CUP</p>
            <p className="text-white/50 text-base sm:text-2xl mt-3 sm:mt-6">En attente du lancement par l&apos;animateur…</p>
          </div>
          <div className="w-10 h-10 border-2 border-canal-yellow/60 border-t-transparent rounded-full animate-spin" />
          {!soundOn && (
            <button onClick={toggleSound} className="mt-2 px-5 py-2.5 rounded-full bg-canal-yellow text-canal-black font-black text-sm sm:text-lg flex items-center gap-2 shadow-lg">
              <Volume2 size={18} /> Activer le son
            </button>
          )}
        </div>
        {soundBtn}
      </PinGate>
    );
  }

  const q = session.question;
  const rawElapsed = Date.now() - new Date(session.started_at).getTime();
  const inCountdown = session.phase === "countdown" || rawElapsed < 0;
  const isReveal = session.phase === "reveal";
  const countdownLeft = Math.max(1, Math.ceil(-rawElapsed / 1000));
  const elapsedMs = Math.max(0, rawElapsed);
  const timeLeft = Math.max(0, Math.ceil((QUIZ_TIMER_SECONDS * 1000 - elapsedMs) / 1000));
  const timerPct = Math.max(0, (timeLeft / QUIZ_TIMER_SECONDS) * 100);
  const timerColor =
    timeLeft <= 2 ? "bg-red-500" : timeLeft <= 3 ? "bg-orange-500" : timeLeft <= 5 ? "bg-yellow-400" : "bg-canal-yellow";
  const answerText = (key: string) =>
    ({ A: q.answer_a, B: q.answer_b, C: q.answer_c, D: q.answer_d }[key] ?? "");

  // ── Countdown ──────────────────────────────────────────────────────────────
  if (inCountdown) {
    return (
      <PinGate>
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 px-4 select-none" style={{ background: WARM_BG }}>
          <p className="text-white/50 text-2xl sm:text-4xl uppercase tracking-widest">
            Question {session.question_index + 1}
            {session.total > 0 && <span className="text-white/30"> / {session.total}</span>}
          </p>
          <p key={countdownLeft} className="text-canal-yellow font-black text-[9rem] sm:text-[16rem] leading-none tabular-nums animate-pulse">
            {countdownLeft}
          </p>
          <p className="text-white/40 text-lg sm:text-3xl italic">Préparez-vous… 👀</p>
        </div>
        {soundBtn}
      </PinGate>
    );
  }

  const correct = session.correct_answer;
  const dist = session.distribution ?? { A: 0, B: 0, C: 0, D: 0 };
  const responded = session.responded ?? 0;
  const participants = session.participants ?? 0;
  const respondedPct = participants > 0 ? Math.round((responded / participants) * 100) : 0;
  const pctOf = (key: "A" | "B" | "C" | "D") => (responded > 0 ? Math.round((dist[key] / responded) * 100) : 0);
  const correctCount = correct ? dist[correct as "A" | "B" | "C" | "D"] ?? 0 : 0;
  const wrongPct = responded > 0 ? Math.round(((responded - correctCount) / responded) * 100) : 0;
  const fastest = session.fastest ?? null;
  // Petite punchline de salle selon le résultat collectif.
  const funnyStat =
    responded === 0
      ? "🦗 Personne n'a répondu…"
      : correctCount === 0
        ? "😱 Personne n'a trouvé !"
        : wrongPct >= 70
          ? `🎯 ${wrongPct} % se sont trompés`
          : correctCount === responded
            ? "🔥 Tout le monde a trouvé !"
            : `✅ ${correctCount} ${correctCount > 1 ? "ont" : "a"} trouvé`;

  return (
    <PinGate>
      <div className="fixed inset-0 flex flex-col select-none" style={{ background: WARM_BG }}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-12 py-3 sm:py-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <span className="font-black text-lg sm:text-3xl text-canal-yellow">CANAL</span>
            <span className="font-black text-lg sm:text-3xl text-white">CUP</span>
            <span className="font-black text-lg sm:text-3xl text-white/30 hidden sm:inline">QUIZ</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-8">
            {(q.category || q.difficulty) && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xl sm:text-3xl">{CATEGORY_ICONS[q.category ?? ""] ?? "🎲"}</span>
                <span className={`font-bold text-sm sm:text-xl ${DIFFICULTY_COLORS[q.difficulty ?? ""] ?? "text-white/50"}`}>
                  {DIFFICULTY_LABELS[q.difficulty ?? ""] ?? q.difficulty}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="font-black text-2xl sm:text-4xl text-white tabular-nums">{session.question_index + 1}</span>
              <span className="text-white/30 text-xl sm:text-3xl">/</span>
              <span className="text-white/30 text-xl sm:text-3xl">{session.total}</span>
            </div>
          </div>
        </header>

        {/* Question + réponses */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-10 lg:px-16 gap-5 sm:gap-8 min-h-0 overflow-y-auto py-4">
          <p className="font-black text-xl sm:text-4xl xl:text-5xl text-white leading-tight text-center max-w-5xl mx-auto break-words text-balance">
            {q.question}
          </p>

          {!isReveal ? (
            // — Phase question : 4 cartouches colorées —
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 max-w-6xl mx-auto w-full">
              {ANSWER_KEYS.map((key) => {
                const palette = ANSWER_PALETTE[key];
                return (
                  <div key={key} className={`rounded-2xl sm:rounded-3xl p-3.5 sm:p-7 flex items-center gap-3 sm:gap-6 shadow-lg ${palette.bg}`}>
                    <span className={`font-black text-2xl sm:text-4xl xl:text-5xl w-8 sm:w-14 text-center shrink-0 ${palette.text}`}>{key}</span>
                    <span className={`font-bold text-base sm:text-2xl xl:text-3xl leading-snug min-w-0 break-words ${palette.text}`}>{answerText(key)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            // — Phase reveal : chorégraphie en plusieurs temps (revealStage) —
            <div className="max-w-5xl mx-auto w-full flex flex-col gap-4 sm:gap-6">
              {/* Stage 0 — Temps écoulé */}
              <div className="text-center" style={{ animation: "fadeUp .4s both" }}>
                <span className="text-white/60 font-black text-xl sm:text-4xl uppercase tracking-widest">⏱ Temps écoulé</span>
              </div>

              {/* Stage 1 — nb de répondants + % */}
              {revealStage >= 1 && (
                <div className="flex items-center justify-center gap-3 sm:gap-6 text-center" style={{ animation: "fadeUp .4s both" }}>
                  <span className="text-white font-black text-xl sm:text-4xl tabular-nums">{responded} / {participants}</span>
                  <span className="text-white/40 font-bold text-base sm:text-2xl">joueurs</span>
                  <span className="text-canal-yellow font-black text-2xl sm:text-5xl tabular-nums">{respondedPct}%</span>
                </div>
              )}

              {/* Stage 2 — barres séquencées A→B→C→D ; le bon ne s'allume qu'au stage 3 */}
              {revealStage >= 2 && (
                <div className="flex flex-col gap-2.5 sm:gap-3.5">
                  {ANSWER_KEYS.map((key, i) => {
                    const palette = ANSWER_PALETTE[key];
                    const pct = pctOf(key);
                    const isCorrect = key === correct;
                    const lit = revealStage >= 3 && isCorrect;
                    return (
                      <div key={key} className="flex items-center gap-3 sm:gap-5" style={{ animation: "fadeUp .4s both", animationDelay: `${i * 0.12}s` }}>
                        <span className={`font-black text-xl sm:text-3xl w-12 sm:w-24 text-center shrink-0 transition-colors ${lit ? "text-green-400" : "text-white/40"}`}>
                          {lit ? `✓ ${key}` : key}
                        </span>
                        <div className="flex-1 h-9 sm:h-14 bg-white/5 rounded-xl overflow-hidden relative">
                          <div
                            className={`h-full rounded-xl transition-colors duration-300 ${lit ? "bg-green-500" : palette.bar} ${revealStage >= 3 && !isCorrect ? "opacity-40" : "opacity-80"}`}
                            style={{ width: `${Math.max(pct, 3)}%`, transformOrigin: "left", animation: "growX .6s ease-out both", animationDelay: `${i * 0.12}s` }}
                          />
                          <span className="absolute inset-0 flex items-center px-3 sm:px-5">
                            <span className="font-bold text-sm sm:text-2xl truncate text-white/80">{answerText(key)}</span>
                          </span>
                          <span className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 font-black text-base sm:text-3xl tabular-nums text-white">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Stage 3 — bonne réponse (✓ + lettre + texte), avec un POP discret */}
              {revealStage >= 3 && correct && (
                <div className="text-center mt-1 sm:mt-3">
                  <p
                    className="text-green-400 font-black text-2xl sm:text-5xl inline-flex items-center justify-center gap-3 flex-wrap"
                    style={{ animation: "pop .5s ease-out both" }}
                  >
                    ✅ <span className="text-white/50">{correct}</span> {answerText(correct)}
                  </p>
                </div>
              )}

              {/* Stage 4 — explication + stats d'ambiance (le plus rapide, punchline) */}
              {revealStage >= 4 && (
                <div className="flex flex-col items-center gap-3 sm:gap-4" style={{ animation: "fadeUp .5s both" }}>
                  {session.explanation && (
                    <p className="text-white/55 text-sm sm:text-2xl italic text-center max-w-3xl mx-auto leading-snug">{session.explanation}</p>
                  )}
                  <div className="flex items-center justify-center gap-4 sm:gap-10 flex-wrap">
                    <span className="text-white/70 font-bold text-base sm:text-3xl">{funnyStat}</span>
                    {fastest && (
                      <span className="flex items-center gap-2 text-canal-yellow font-black text-base sm:text-3xl">
                        ⚡ {fastest.name} <span className="text-white/50 tabular-nums">{(fastest.ms / 1000).toFixed(2)}s</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer : chrono géant (question) ou consigne (reveal) */}
        <footer className="shrink-0 px-4 sm:px-12 pb-5 sm:pb-8 pt-3 sm:pt-4 border-t border-white/5">
          {!isReveal ? (
            <div className="flex items-center gap-3 sm:gap-5">
              <span
                key={timeLeft <= 3 ? `t${timeLeft}` : "calm"}
                className={`font-black text-3xl sm:text-6xl tabular-nums w-16 sm:w-28 text-right ${
                  timeLeft <= 2 ? "text-red-500" : timeLeft <= 3 ? "text-orange-400" : timeLeft <= 5 ? "text-yellow-300" : "text-white"
                }`}
                style={timeLeft <= 3 ? { animation: "popSec .45s ease-out both", transformOrigin: "right center" } : undefined}
              >
                {timeLeft}s
              </span>
              <div className="flex-1 h-2.5 sm:h-4 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${timerColor}`} style={{ width: `${timerPct}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-white/35 text-center text-sm sm:text-2xl">
              {responded} réponse{responded > 1 ? "s" : ""} · l&apos;animateur lance la question suivante
            </p>
          )}
        </footer>
      </div>
      {soundBtn}

      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes growX {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes pop {
          0% { transform: scale(0.8); }
          60% { transform: scale(1.14); }
          100% { transform: scale(1); }
        }
        @keyframes popSec {
          0% { transform: scale(1.55); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </PinGate>
  );
}
