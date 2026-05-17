"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { QuizQuestion } from "@/lib/supabase/types";

const TIMER_SECONDS = 20;

type ShowState = "intro" | "question" | "revealing" | "finished";

const ANSWER_KEYS = ["A", "B", "C", "D"] as const;

const ANSWER_PALETTE: Record<string, { border: string; bg: string; letter: string }> = {
  A: { border: "border-canal-yellow/60", bg: "bg-canal-yellow/10", letter: "text-canal-yellow" },
  B: { border: "border-blue-400/60",      bg: "bg-blue-950/40",      letter: "text-blue-300" },
  C: { border: "border-purple-400/60",    bg: "bg-purple-950/40",    letter: "text-purple-300" },
  D: { border: "border-orange-400/60",    bg: "bg-orange-950/40",    letter: "text-orange-300" },
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
      <div className="fixed inset-0 bg-canal-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ok) {
    return (
      <div className="fixed inset-0 bg-canal-black flex flex-col items-center justify-center gap-6">
        <p className="text-canal-yellow font-black text-4xl">QUIZ CANAL CUP</p>
        <p className="text-canal-gray-muted text-2xl">Accès réservé à l'animateur.</p>
        <p className="text-canal-gray-muted text-lg mt-2">
          Ajoutez <span className="text-canal-yellow font-mono">?pin=XXXX</span> à l'URL.
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
      // Shuffle so it's not the same order every time
      setQuestions([...data].sort(() => Math.random() - 0.5));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  // State machine: Space / → / Enter / click always advances
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
      // Restart
      setQuestions((prev) => [...prev].sort(() => Math.random() - 0.5));
      setIdx(0);
      setTimeLeft(TIMER_SECONDS);
      setState("intro");
    }
  }, [state, loading, questions.length, isLast]);

  // Keyboard handler
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

  // Timer — auto-reveal when reaching 0
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
          className="fixed inset-0 bg-canal-black flex flex-col items-center justify-center gap-12 cursor-pointer select-none"
          onClick={!loading ? advance : undefined}
        >
          <div className="text-center">
            <span className="text-9xl block mb-8">🏆</span>
            <p className="font-black text-7xl text-canal-yellow uppercase tracking-widest mb-3">QUIZ</p>
            <p className="font-black text-5xl text-white uppercase tracking-wide mb-2">CANAL CUP</p>
            <p className="font-black text-4xl text-white">2026</p>
            <p className="text-canal-gray-muted text-2xl mt-6">Coupe du Monde — Qui sait le plus ?</p>
          </div>

          {loading ? (
            <div className="w-12 h-12 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="px-16 py-6 bg-canal-yellow rounded-3xl">
                <p className="font-black text-canal-black text-3xl">DÉMARRER</p>
              </div>
              <p className="text-canal-gray-muted text-xl">
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
          className="fixed inset-0 bg-canal-black flex flex-col items-center justify-center gap-12 cursor-pointer select-none"
          onClick={advance}
        >
          <span className="text-9xl">🏆</span>
          <div className="text-center">
            <p className="font-black text-6xl text-canal-yellow mb-4">QUIZ TERMINÉ !</p>
            <p className="text-canal-gray-muted text-3xl">{questions.length} questions · Bravo à tous</p>
          </div>
          <p className="text-canal-gray-muted text-2xl italic max-w-2xl text-center">
            "Robert valide les bonnes réponses. En silence."
          </p>
          <p className="text-canal-gray-muted text-xl mt-8">ESPACE pour rejouer</p>
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
        className="fixed inset-0 bg-canal-black flex flex-col select-none cursor-pointer"
        onClick={advance}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-12 py-5 border-b border-canal-gray-light shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-black text-3xl text-canal-yellow">CANAL</span>
            <span className="font-black text-3xl text-white">CUP</span>
            <span className="font-black text-3xl text-canal-gray-muted">QUIZ</span>
          </div>

          <div className="flex items-center gap-8">
            {/* Category */}
            <div className="flex items-center gap-2">
              <span className="text-3xl">{CATEGORY_ICONS[q.category] ?? "🎲"}</span>
              <span className={`font-bold text-xl ${DIFFICULTY_COLORS[q.difficulty] ?? "text-canal-gray-muted"}`}>
                {DIFFICULTY_LABELS[q.difficulty] ?? q.difficulty}
              </span>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-2">
              <span className="font-black text-4xl text-white tabular-nums">{idx + 1}</span>
              <span className="text-canal-gray-muted text-3xl">/</span>
              <span className="text-canal-gray-muted text-3xl">{questions.length}</span>
            </div>
          </div>
        </header>

        {/* ── Question text ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center px-16 gap-10">
          <p className="font-black text-5xl text-white leading-tight text-center max-w-5xl mx-auto">
            {q.question}
          </p>

          {/* ── Answer grid ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-5 max-w-6xl mx-auto w-full">
            {ANSWER_KEYS.map((key) => {
              const text = answerText(key);
              const isCorrect = key === q.correct_answer;
              const palette = ANSWER_PALETTE[key];

              const isRevealing = state === "revealing";

              const boxClass = `
                rounded-3xl border-2 p-7 flex items-center gap-6 transition-all duration-300
                ${isRevealing
                  ? isCorrect
                    ? "bg-green-900/70 border-green-400"
                    : "bg-canal-gray/15 border-canal-gray-light/20 opacity-35"
                  : `${palette.bg} ${palette.border}`
                }
              `;

              return (
                <div key={key} className={boxClass}>
                  <span className={`
                    font-black text-5xl w-14 text-center shrink-0 leading-none
                    ${isRevealing
                      ? isCorrect ? "text-green-300" : "text-canal-gray-muted"
                      : palette.letter
                    }
                  `}>
                    {isRevealing && isCorrect ? "✓" : key}
                  </span>
                  <span className={`
                    font-bold text-3xl leading-snug
                    ${isRevealing
                      ? isCorrect ? "text-white" : "text-canal-gray-muted"
                      : "text-white"
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
        <footer className="shrink-0 px-12 pb-10 pt-4 space-y-4">
          {/* Timer bar — hidden when revealed */}
          {state === "question" && (
            <div className="flex items-center gap-5">
              <span className={`
                font-black text-4xl tabular-nums w-16 text-right
                ${timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white"}
              `}>
                {timeLeft}s
              </span>
              <div className="flex-1 h-3 bg-canal-gray-mid rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Keyboard hint */}
          <div className="flex items-center justify-between">
            <p className="text-canal-gray-muted text-xl">
              {state === "question"
                ? "ESPACE → révéler la réponse"
                : isLast
                ? "ESPACE → terminer"
                : `ESPACE → question ${idx + 2}`}
            </p>

            {/* Progress dots */}
            <div className="flex gap-1.5 flex-wrap max-w-xs justify-end">
              {questions.slice(0, Math.min(questions.length, 20)).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i < idx ? "w-4 bg-canal-yellow/50" :
                    i === idx ? "w-6 bg-canal-yellow" :
                    "w-2 bg-canal-gray-light"
                  }`}
                />
              ))}
              {questions.length > 20 && (
                <span className="text-canal-gray-muted text-xs self-center">+{questions.length - 20}</span>
              )}
            </div>
          </div>
        </footer>
      </div>
    </PinGate>
  );
}
