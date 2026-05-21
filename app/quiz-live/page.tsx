"use client";

// Quiz Live SHOW (mode live) : pas de chrono indépendant côté client.
// L'admin pilote depuis /admin/quiz ; tous les joueurs voient la même
// question simultanément. Le client poll /api/quiz/session toutes les
// 2 secondes. Le chrono est CALCULÉ à partir de session.started_at
// (UTC serveur) — toujours synchronisé entre joueurs.

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Timer, CheckCircle, XCircle, Zap, Hourglass, Trophy } from "lucide-react";
import { QUIZ_TIMER_SECONDS } from "@/lib/scoring";

const ANSWERS = ["A", "B", "C", "D"] as const;
const POLL_INTERVAL_MS = 2000;
const TIMER_SECONDS = QUIZ_TIMER_SECONDS; // 20s
const FAST_S = 5;

interface LiveQuestion {
  id: string;
  question: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  category?: string;
  difficulty?: string;
}

type SessionState =
  | { status: "idle" }
  | {
      status: "question";
      question: LiveQuestion;
      started_at: string;
      question_index: number;
      total: number;
    };

interface AnswerOutcome {
  questionId: string;
  selected: string; // "" si timeout
  is_correct: boolean;
  points: number;
}

export default function QuizLivePage() {
  const [session, setSession] = useState<SessionState>({ status: "idle" });
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, forceTick] = useState(0);
  const lastQuestionIdRef = useRef<string | null>(null);
  const autoTimeoutFiredRef = useRef<string | null>(null);

  // Poll /api/quiz/session
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/quiz/session", { credentials: "same-origin" });
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled) return;
        if (d.status === "question" && d.question) {
          setSession({
            status: "question",
            question: d.question,
            started_at: d.started_at,
            question_index: d.question_index ?? 0,
            total: d.total ?? 0,
          });
        } else {
          setSession({ status: "idle" });
        }
      } catch {
        /* silencieux */
      }
    };
    load();
    const t = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Reset l'outcome local quand la question change (admin a cliqué "suivante")
  useEffect(() => {
    if (session.status !== "question") {
      lastQuestionIdRef.current = null;
      autoTimeoutFiredRef.current = null;
      return;
    }
    if (lastQuestionIdRef.current !== session.question.id) {
      lastQuestionIdRef.current = session.question.id;
      autoTimeoutFiredRef.current = null;
      setOutcome(null);
    }
  }, [session]);

  // Re-render toutes les 500ms pour rafraîchir le chrono
  useEffect(() => {
    if (session.status !== "question") return;
    const t = setInterval(() => forceTick((v) => v + 1), 500);
    return () => clearInterval(t);
  }, [session.status]);

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (session.status !== "question") return;
      if (outcome || submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/quiz/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            question_id: session.question.id,
            answer,
          }),
        });
        const d = await res.json().catch(() => ({}));
        setOutcome({
          questionId: session.question.id,
          selected: answer,
          is_correct: !!d.is_correct,
          points: typeof d.points === "number" ? d.points : 0,
        });
      } catch {
        setOutcome({
          questionId: session.question.id,
          selected: answer,
          is_correct: false,
          points: 0,
        });
      }
      setSubmitting(false);
    },
    [session, outcome, submitting]
  );

  // Auto-submit "" (timeout) si l'utilisateur n'a pas répondu à temps,
  // pour qu'il voie "Temps écoulé — 0 pt" et qu'on persiste 0 côté DB.
  useEffect(() => {
    if (session.status !== "question") return;
    if (outcome) return;
    const elapsed = Date.now() - new Date(session.started_at).getTime();
    if (elapsed > TIMER_SECONDS * 1000 + 250) {
      if (autoTimeoutFiredRef.current === session.question.id) return;
      autoTimeoutFiredRef.current = session.question.id;
      void submitAnswer("");
    }
  });

  // Idle : pas de session active
  if (session.status === "idle") {
    return (
      <div className="px-4 py-8 max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="canal-headline text-2xl">Quiz Live ⚡</h1>
          <p className="text-canal-gray-muted text-sm mt-1">
            Le quiz est lancé par l&apos;animateur — reste sur cette page.
          </p>
        </div>

        <div className="canal-card text-center py-8">
          <Hourglass className="mx-auto text-canal-yellow mb-3" size={32} />
          <p className="font-black text-white text-lg">En attente du quiz…</p>
          <p className="text-canal-gray-muted text-sm mt-2 leading-relaxed">
            Quand l&apos;animateur lancera le quiz, les questions apparaîtront ici
            <br />
            automatiquement. Garde cette page ouverte.
          </p>
        </div>

        <div className="canal-card space-y-3 text-sm">
          <p className="text-canal-yellow font-bold flex items-center gap-2">
            <Trophy size={14} /> Règles du jeu
          </p>
          <ul className="space-y-1.5 text-canal-gray-muted">
            <li>• <b>{TIMER_SECONDS} secondes</b> pour répondre à chaque question.</li>
            <li>
              • Bonne réponse en <b>moins de {FAST_S}s</b> :{" "}
              <span className="text-canal-yellow font-bold">+5 pts</span>
            </li>
            <li>
              • Bonne réponse plus lente :{" "}
              <span className="text-canal-yellow font-bold">+3 pts</span>
            </li>
            <li>
              • Mauvaise réponse ou temps écoulé :{" "}
              <span className="text-canal-gray-muted">0 pt</span>
            </li>
            <li>• Les points vont à ton équipe Canal Cup principale.</li>
          </ul>
        </div>
      </div>
    );
  }

  // Question active
  const q = session.question;
  const elapsedMs = Math.max(0, Date.now() - new Date(session.started_at).getTime());
  const timeLeft = Math.max(0, Math.ceil((TIMER_SECONDS * 1000 - elapsedMs) / 1000));
  const timedOut = elapsedMs > TIMER_SECONDS * 1000;
  const timerPct = Math.max(0, (timeLeft / TIMER_SECONDS) * 100);
  const timerColor = timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-yellow-400" : "bg-canal-yellow";

  const getAnswerText = (key: string) => {
    const map: Record<string, string> = {
      A: q.answer_a,
      B: q.answer_b,
      C: q.answer_c,
      D: q.answer_d,
    };
    return map[key] ?? "";
  };

  const wasAnswered = !!outcome;
  const locked = wasAnswered || submitting || timedOut;

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto flex flex-col gap-5">
      {/* En-tête : position dans le quiz */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-canal-gray-muted">
          Question{" "}
          <span className="text-white font-bold">{session.question_index + 1}</span>
          {session.total > 0 && <span> / {session.total}</span>}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 font-black text-2xl tabular-nums",
            timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white"
          )}
        >
          <Timer size={16} className={timeLeft <= 5 ? "text-red-400" : "text-canal-gray-muted"} />
          {timeLeft}s
        </span>
      </div>

      {/* Barre de progression du chrono */}
      <div className="h-2 bg-canal-gray-mid rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", timerColor)}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Question */}
      <div className="canal-card">
        {(q.category || q.difficulty) && (
          <span className="text-xs text-canal-gray-muted uppercase tracking-wider">
            {q.category}
            {q.category && q.difficulty ? " · " : ""}
            {q.difficulty}
          </span>
        )}
        <p className="font-bold text-white text-lg mt-2 leading-snug">{q.question}</p>
      </div>

      {/* Réponses */}
      <div className="grid grid-cols-1 gap-3">
        {ANSWERS.map((key) => {
          const text = getAnswerText(key);
          const isSelected = outcome?.selected === key;
          let btnClass = "canal-card flex items-center gap-3 w-full text-left transition-all";
          if (wasAnswered) {
            if (isSelected) {
              btnClass += outcome?.is_correct
                ? " border border-canal-green bg-green-950/30"
                : " border border-red-500 bg-red-950/30";
            } else {
              btnClass += " opacity-40";
            }
          } else if (locked) {
            btnClass += " opacity-50";
          } else {
            btnClass += " hover:border-canal-yellow/50 hover:bg-canal-gray-mid active:scale-98";
          }
          return (
            <button
              key={key}
              onClick={() => submitAnswer(key)}
              disabled={locked}
              className={btnClass}
            >
              <span className="w-8 h-8 rounded-lg bg-canal-gray-light flex items-center justify-center font-black text-sm flex-shrink-0">
                {key}
              </span>
              <span className="flex-1 text-sm font-medium">{text}</span>
              {wasAnswered && isSelected && outcome?.is_correct && (
                <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
              )}
              {wasAnswered && isSelected && !outcome?.is_correct && (
                <XCircle size={18} className="text-red-400 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bandeau résultat */}
      {outcome && outcome.selected !== "" && (
        <div
          className={cn(
            "canal-card text-center",
            outcome.is_correct
              ? "border border-green-700/40 bg-green-900/20"
              : "border border-red-700/40 bg-red-900/20"
          )}
        >
          {outcome.is_correct ? (
            <p className="text-green-400 font-black text-base flex items-center justify-center gap-2 flex-wrap">
              <CheckCircle size={16} /> Bonne réponse — +{outcome.points} pts
              {outcome.points === 5 && (
                <span className="flex items-center gap-1 text-canal-yellow text-xs ml-2">
                  <Zap size={12} /> Bonus rapidité
                </span>
              )}
            </p>
          ) : (
            <p className="text-red-400 font-black text-base flex items-center justify-center gap-2">
              <XCircle size={16} /> Mauvaise réponse — 0 pt
            </p>
          )}
          <p className="text-canal-gray-muted text-xs mt-1">
            Attends que l&apos;animateur passe à la question suivante…
          </p>
        </div>
      )}

      {/* Timeout (auto-submit a envoyé "") */}
      {outcome && outcome.selected === "" && (
        <div className="canal-card text-center border border-canal-gray-light">
          <p className="text-canal-gray-muted font-bold text-sm flex items-center justify-center gap-2">
            <Hourglass size={14} /> Temps écoulé — 0 pt
          </p>
          <p className="text-canal-gray-muted text-xs mt-1">
            Attends que l&apos;animateur passe à la question suivante…
          </p>
        </div>
      )}
    </div>
  );
}
