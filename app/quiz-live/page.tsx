"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Timer, CheckCircle, XCircle, Zap } from "lucide-react";
import type { QuizQuestion } from "@/lib/supabase/types";
import { quizPoints, QUIZ_TIMER_SECONDS } from "@/lib/scoring";

type GameState = "idle" | "question" | "answered" | "finished" | "loading";

const ANSWERS = ["A", "B", "C", "D"] as const;
const TIMER_SECONDS = QUIZ_TIMER_SECONDS;

export default function QuizLivePage() {
  const [state, setState] = useState<GameState>("idle");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);

  const currentQ = questions[questionIndex];

  const answerQuestion = useCallback(
    (answer: string) => {
      if (state !== "question") return;
      const isCorrect = answer !== "" && answer === currentQ.correct_answer;
      const responseTimeMs = (TIMER_SECONDS - timeLeft) * 1000;
      const pts = quizPoints(isCorrect, responseTimeMs);
      setSelected(answer);
      setState("answered");
      setResults((r) => [...r, isCorrect]);
      setScore((s) => s + pts);
      // Persistance Supabase — best-effort, n'altère jamais le jeu. Le serveur
      // refait foi (relit la bonne réponse, recalcule les points).
      fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: currentQ.id,
          answer,
          response_time_ms: responseTimeMs,
        }),
      }).catch(() => {});
    },
    [state, currentQ, timeLeft]
  );

  useEffect(() => {
    if (state !== "question") return;
    if (timeLeft <= 0) {
      answerQuestion("");
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [state, timeLeft, answerQuestion]);

  const startQuiz = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/quiz");
      const data: QuizQuestion[] = await res.json();
      setQuestions(data);
      setQuestionIndex(0);
      setSelected(null);
      setTimeLeft(TIMER_SECONDS);
      setScore(0);
      setResults([]);
      setState("question");
    } catch {
      setState("idle");
    }
  };

  const nextQuestion = () => {
    if (questionIndex + 1 >= questions.length) {
      setState("finished");
    } else {
      setQuestionIndex((i) => i + 1);
      setSelected(null);
      setTimeLeft(TIMER_SECONDS);
      setState("question");
    }
  };

  const getAnswerText = (key: string) => {
    if (!currentQ) return "";
    const map: Record<string, string> = {
      A: currentQ.answer_a,
      B: currentQ.answer_b,
      C: currentQ.answer_c,
      D: currentQ.answer_d,
    };
    return map[key] ?? "";
  };

  if (state === "idle" || state === "loading") {
    return (
      <div className="px-4 py-4 max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="canal-headline text-2xl">Quiz Live ⚡</h1>
          <p className="text-canal-gray-muted text-sm mt-1">
            15 secondes par question. La rapidité rapporte des points bonus.
          </p>
        </div>
        <div className="canal-card space-y-3 text-sm">
          <p className="text-canal-yellow font-bold">Règles :</p>
          <ul className="space-y-1 text-canal-gray-muted">
            <li>✓ Bonne réponse : +3 pts</li>
            <li>✓ Bonne réponse en moins de 10s : +5 pts</li>
            <li>✗ Mauvaise réponse ou timeout : 0 pt</li>
          </ul>
        </div>
        <button
          onClick={startQuiz}
          disabled={state === "loading"}
          className="w-full py-4 bg-canal-yellow text-canal-black font-black text-lg rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-50"
        >
          {state === "loading" ? "Chargement…" : "Démarrer le Quiz ⚡"}
        </button>
      </div>
    );
  }

  if (state === "finished") {
    const correct = results.filter(Boolean).length;
    return (
      <div className="px-4 py-4 max-w-2xl mx-auto flex flex-col gap-6">
        <div className="canal-card text-center py-8">
          <p className="text-6xl mb-4">
            {correct === questions.length ? "🏆" : correct >= questions.length / 2 ? "⭐" : "💪"}
          </p>
          <h2 className="canal-headline text-3xl mb-2">{score} points</h2>
          <p className="text-canal-gray-muted">
            {correct}/{questions.length} bonnes réponses
          </p>
          <p className="text-canal-yellow font-bold mt-2 italic">
            {correct === questions.length
              ? "Parfait ! Le coach IA est impressionné."
              : correct >= questions.length / 2
              ? "Pas mal pour quelqu'un qui regarde Canal+."
              : "Le foot, c'est compliqué. Mais vous avez essayé."}
          </p>
        </div>
        <button
          onClick={startQuiz}
          className="w-full py-3 bg-canal-gray-mid text-white font-bold rounded-xl border border-canal-gray-light hover:bg-canal-gray-light transition-colors"
        >
          Rejouer
        </button>
      </div>
    );
  }

  const timerPct = (timeLeft / TIMER_SECONDS) * 100;
  const timerColor = timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-yellow-400" : "bg-canal-yellow";

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between text-sm text-canal-gray-muted">
        <span>Question {questionIndex + 1}/{questions.length}</span>
        <span className="flex items-center gap-1 text-canal-yellow font-bold">
          <Zap size={14} /> {score} pts
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Timer size={14} className={timeLeft <= 5 ? "text-red-400" : "text-canal-gray-muted"} />
          <span className={cn("font-black text-2xl", timeLeft <= 5 ? "text-red-400" : "text-white")}>
            {timeLeft}s
          </span>
        </div>
        <div className="h-2 bg-canal-gray-mid rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-1000", timerColor)}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      </div>

      <div className="canal-card">
        <span className="text-xs text-canal-gray-muted uppercase tracking-wider">
          {currentQ.category} · {currentQ.difficulty}
        </span>
        <p className="font-bold text-white text-lg mt-2 leading-snug">{currentQ.question}</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {ANSWERS.map((key) => {
          const text = getAnswerText(key);
          const isCorrect = key === currentQ.correct_answer;
          const isSelected = selected === key;

          let btnClass = "canal-card flex items-center gap-3 w-full text-left transition-all";
          if (state === "answered") {
            if (isCorrect) btnClass += " border border-canal-green bg-green-950/30";
            else if (isSelected) btnClass += " border border-red-500 bg-red-950/30";
            else btnClass += " opacity-40";
          } else {
            btnClass += " hover:border-canal-yellow/50 hover:bg-canal-gray-mid active:scale-98";
          }

          return (
            <button
              key={key}
              onClick={() => answerQuestion(key)}
              disabled={state === "answered"}
              className={btnClass}
            >
              <span className="w-8 h-8 rounded-lg bg-canal-gray-light flex items-center justify-center font-black text-sm flex-shrink-0">
                {key}
              </span>
              <span className="flex-1 text-sm font-medium">{text}</span>
              {state === "answered" && isCorrect && <CheckCircle size={18} className="text-green-400 flex-shrink-0" />}
              {state === "answered" && isSelected && !isCorrect && <XCircle size={18} className="text-red-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {state === "answered" && (
        <button
          onClick={nextQuestion}
          className="w-full py-3 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors"
        >
          {questionIndex + 1 >= questions.length ? "Voir mon score" : "Question suivante →"}
        </button>
      )}
    </div>
  );
}
