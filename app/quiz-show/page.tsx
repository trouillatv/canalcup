"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { QuizQuestion } from "@/lib/supabase/types";

const TIMER_SECONDS = 20;

type ShowState = "intro" | "question" | "revealing" | "finished";

const ANSWER_KEYS = ["A", "B", "C", "D"] as const;

// Solid vivid colors — game show energy, not dark transparent boxes
const ANSWER_PALETTE: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: "bg-canal-yellow",   text: "text-canal-black", ring: "ring-canal-yellow/60" },
  B: { bg: "bg-blue-600",       text: "text-white",        ring: "ring-blue-400/60" },
  C: { bg: "bg-violet-600",     text: "text-white",        ring: "ring-violet-400/60" },
  D: { bg: "bg-orange-500",     text: "text-white",        ring: "ring-orange-400/60" },
};

const CATEGORY_ICONS: Record<string, string> = {
  foot: "⚽", culture: "🌍", canal: "📺", general: "🎲",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Facile", medium: "Moyen", hard: "Difficile",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-green-400", medium: "text-yellow-400", hard: "text-red-400",
};

// Warm dark gradient — stadium under warm lights, not a corporate void
const WARM_BG =
  "radial-gradient(ellipse at 50% -5%, #2A1E08 0%, #130F08 45%, #0A0906 100%)";

// ─── PIN Gate ────────────────────────────────────────────────────────────────

function PinGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const pin = new URLSearchParams(window.location.search).get("pin") ?? "";
    fetch(`/api/tv/auth?pin=${encodeURIComponent(pin)}`)
      .then((r) => setOk(r.ok))
      .catch(() => setOk(false));
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
  const [state, setState] = useState<ShowState>("intro");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [loading, setLoading] = useState(false);

  const q = questions[idx];
  const isLast = idx >= questions.length - 1;

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quiz");
      const data: QuizQuestion[] = await res.json();
      setQuestions([...data].sort(() => Math.random() - 0.5));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const advance = useCallback(() => {
    if (state === "intro" && !loading && questions.length) {
      setIdx(0);
      setTimeLeft(TIMER_SECONDS);
      setState("question");
    } else if (state === "question") {
      setState("revealing");
    } else if (state === "revealing") {
      if (isLast) {
        setState("finished");
      } else {
        setIdx((i) => i + 1);
        setTimeLeft(TIMER_SECONDS);
        setState("question");
      }
    } else if (state === "finished") {
      setQuestions((prev) => [...prev].sort(() => Math.random() - 0.5));
      setIdx(0);
      setTimeLeft(TIMER_SECONDS);
      setState("intro");
    }
  }, [state, loading, questions.length, isLast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  useEffect(() => {
    if (state !== "question") return;
    if (timeLeft <= 0) { setState("revealing"); return; }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [state, timeLeft]);

  const answerText = (key: string) =>
    q ? (q[`answer_${key.toLowerCase()}` as keyof QuizQuestion] as string) : "";

  // ─── INTRO ───────────────────────────────────────────────────────────────

  if (state === "intro") {
    return (
      <PinGate>
        <div
          className="fixed inset-0 flex flex-col items-center justify-center gap-12 cursor-pointer select-none"
          style={{ background: WARM_BG }}
          onClick={!loading ? advance : undefined}
        >
          {/* Ambient warm halo behind trophy */}
          <div className="relative flex flex-col items-center">
            <div className="absolute inset-0 -inset-x-20 bg-canal-yellow/10 rounded-full blur-3xl" />
            <span className="text-9xl relative">🏆</span>
          </div>

          <div className="text-center space-y-2">
            <p className="font-black text-7xl text-canal-yellow uppercase tracking-widest">QUIZ</p>
            <p className="font-black text-5xl text-white uppercase tracking-wide">CANAL CUP</p>
            <p className="font-black text-4xl text-white/70">2026</p>
            <p className="text-white/50 text-2xl mt-6">Coupe du Monde — Qui sait le plus ?</p>
          </div>

          {loading ? (
            <div className="w-12 h-12 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="px-16 py-6 bg-canal-yellow rounded-3xl shadow-[0_0_60px_rgba(255,215,0,0.4)]">
                <p className="font-black text-canal-black text-3xl tracking-wider">DÉMARRER</p>
              </div>
              <p className="text-white/40 text-xl">
                {questions.length} questions · Appuyez sur ESPACE
              </p>
            </div>
          )}
        </div>
      </PinGate>
    );
  }

  // ─── FINISHED ─────────────────────────────────────────────────────────────

  if (state === "finished") {
    return (
      <PinGate>
        <div
          className="fixed inset-0 flex flex-col items-center justify-center gap-12 cursor-pointer select-none"
          style={{ background: WARM_BG }}
          onClick={advance}
        >
          <div className="relative">
            <div className="absolute inset-0 -inset-x-24 bg-canal-yellow/15 rounded-full blur-3xl" />
            <span className="text-9xl relative">🏆</span>
          </div>
          <div className="text-center space-y-4">
            <p className="font-black text-6xl text-canal-yellow">QUIZ TERMINÉ !</p>
            <p className="text-white/60 text-3xl">{questions.length} questions · Bravo à tous</p>
          </div>
          <p className="text-white/35 text-2xl italic max-w-2xl text-center">
            &ldquo;Robert valide les bonnes réponses. En silence.&rdquo;
          </p>
          <p className="text-white/30 text-xl mt-4">ESPACE pour rejouer</p>
        </div>
      </PinGate>
    );
  }

  if (!q) return null;

  // ─── QUESTION / REVEALING ────────────────────────────────────────────────

  const timerPct = (timeLeft / TIMER_SECONDS) * 100;
  const timerColor =
    timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-yellow-400" : "bg-canal-yellow";

  return (
    <PinGate>
      <div
        className="fixed inset-0 flex flex-col select-none cursor-pointer"
        style={{ background: WARM_BG }}
        onClick={advance}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-12 py-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-black text-3xl text-canal-yellow">CANAL</span>
            <span className="font-black text-3xl text-white">CUP</span>
            <span className="font-black text-3xl text-white/30">QUIZ</span>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-3xl">{CATEGORY_ICONS[q.category] ?? "🎲"}</span>
              <span className={`font-bold text-xl ${DIFFICULTY_COLORS[q.difficulty] ?? "text-white/50"}`}>
                {DIFFICULTY_LABELS[q.difficulty] ?? q.difficulty}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-4xl text-white tabular-nums">{idx + 1}</span>
              <span className="text-white/30 text-3xl">/</span>
              <span className="text-white/30 text-3xl">{questions.length}</span>
            </div>
          </div>
        </header>

        {/* ── Question text ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center px-16 gap-10 min-h-0 overflow-y-auto">
          <p className="font-black text-4xl xl:text-5xl text-white leading-tight text-center max-w-5xl mx-auto drop-shadow-sm break-words text-balance">
            {q.question}
          </p>

          {/* ── Answer grid ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 max-w-6xl mx-auto w-full">
            {ANSWER_KEYS.map((key) => {
              const text = answerText(key);
              const isCorrect = key === q.correct_answer;
              const palette = ANSWER_PALETTE[key];
              const isRevealing = state === "revealing";

              let boxClass = `rounded-3xl p-7 flex items-center gap-6 transition-all duration-300 ring-2 ring-transparent `;

              if (isRevealing) {
                if (isCorrect) {
                  boxClass += "bg-green-500 ring-4 ring-green-300/50 shadow-[0_0_40px_rgba(34,197,94,0.4)]";
                } else {
                  boxClass += "bg-white/5 opacity-30";
                }
              } else {
                boxClass += `${palette.bg} hover:ring-white/30 shadow-lg`;
              }

              return (
                <div key={key} className={boxClass}>
                  <span className={`
                    font-black text-4xl xl:text-5xl w-14 text-center shrink-0 leading-none
                    ${isRevealing
                      ? isCorrect ? "text-white" : "text-white/40"
                      : palette.text
                    }
                  `}>
                    {isRevealing && isCorrect ? "✓" : key}
                  </span>
                  <span className={`
                    font-bold text-2xl xl:text-3xl leading-snug min-w-0 break-words
                    ${isRevealing
                      ? isCorrect ? "text-white" : "text-white/40"
                      : palette.text
                    }
                  `}>
                    {text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer className="shrink-0 px-12 pb-10 pt-4 space-y-4 border-t border-white/5">
          {state === "question" && (
            <div className="flex items-center gap-5">
              <span className={`
                font-black text-4xl tabular-nums w-16 text-right
                ${timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white"}
              `}>
                {timeLeft}s
              </span>
              <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-white/30 text-xl">
              {state === "question"
                ? "ESPACE → révéler la réponse"
                : isLast
                ? "ESPACE → terminer"
                : `ESPACE → question ${idx + 2}`}
            </p>

            <div className="flex gap-1.5 flex-wrap max-w-xs justify-end">
              {questions.slice(0, Math.min(questions.length, 20)).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i < idx ? "w-4 bg-canal-yellow/40" :
                    i === idx ? "w-6 bg-canal-yellow" :
                    "w-2 bg-white/15"
                  }`}
                />
              ))}
              {questions.length > 20 && (
                <span className="text-white/25 text-xs self-center">+{questions.length - 20}</span>
              )}
            </div>
          </div>
        </footer>
      </div>
    </PinGate>
  );
}
