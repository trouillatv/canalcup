"use client";

// Quiz Live SHOW (téléphone joueur). L'animateur pilote depuis /admin/quiz ;
// l'écran TV maître (/quiz-show) orchestre. Tous les joueurs voient la même
// question simultanément. Poll /api/quiz/session toutes les ~1s. Le chrono est
// CALCULÉ depuis session.started_at (UTC serveur) → synchronisé entre joueurs,
// sans dérive.
//
// Déroulé côté joueur :
//   1. countdown → "3 / 2 / 1"
//   2. question  → 4 réponses ; au clic : "Réponse enregistrée — en attente"
//      (on NE dit PAS encore si c'est juste : suspense jusqu'au reveal)
//   3. reveal    → "Temps écoulé", la bonne réponse + ton résultat perso.

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Timer, CheckCircle, Zap, Hourglass, Trophy } from "lucide-react";
import { QUIZ_TIMER_SECONDS, QUIZ_MIN_RESPONSE_MS } from "@/lib/scoring";

const ANSWERS = ["A", "B", "C", "D"] as const;
const POLL_INTERVAL_MS = 1000;
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
      status: "live";
      phase: "countdown" | "question" | "reveal";
      question: LiveQuestion;
      started_at: string;
      question_index: number;
      total: number;
      correct_answer?: string;
      explanation?: string;
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
  const vibratedRef = useRef<string | null>(null);

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
            status: "live",
            phase: d.phase ?? "question",
            question: d.question,
            started_at: d.started_at,
            question_index: d.question_index ?? 0,
            total: d.total ?? 0,
            correct_answer: d.correct_answer,
            explanation: d.explanation,
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

  // Reset l'outcome local quand la question change (animateur a cliqué "suivante")
  useEffect(() => {
    if (session.status !== "live") {
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

  // Re-render toutes les 300ms pour rafraîchir le chrono
  useEffect(() => {
    if (session.status !== "live") return;
    const t = setInterval(() => forceTick((v) => v + 1), 300);
    return () => clearInterval(t);
  }, [session.status]);

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (session.status !== "live") return;
      if (outcome || submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/quiz/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ question_id: session.question.id, answer }),
        });
        const d = await res.json().catch(() => ({}));
        setOutcome({
          questionId: session.question.id,
          selected: answer,
          is_correct: !!d.is_correct,
          points: typeof d.points === "number" ? d.points : 0,
        });
      } catch {
        setOutcome({ questionId: session.question.id, selected: answer, is_correct: false, points: 0 });
      }
      setSubmitting(false);
    },
    [session, outcome, submitting]
  );

  // Auto-submit "" (timeout) si l'utilisateur n'a pas répondu à temps.
  useEffect(() => {
    if (session.status !== "live") return;
    if (outcome) return;
    const elapsed = Date.now() - new Date(session.started_at).getTime();
    if (elapsed > TIMER_SECONDS * 1000 + 250) {
      if (autoTimeoutFiredRef.current === session.question.id) return;
      autoTimeoutFiredRef.current = session.question.id;
      void submitAnswer("");
    }
  });

  // 📳 Vibration de panique : dans les 3 dernières secondes, UNE fois, et
  // seulement si le joueur n'a pas encore répondu (sinon inutile de le stresser).
  useEffect(() => {
    if (session.status !== "live" || session.phase !== "question" || outcome) return;
    const left = TIMER_SECONDS * 1000 - (Date.now() - new Date(session.started_at).getTime());
    if (left <= 3000 && left > 0 && vibratedRef.current !== session.question.id) {
      vibratedRef.current = session.question.id;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([90, 60, 90, 60, 160]);
      }
    }
  });

  // ── Idle : pas de session active ───────────────────────────────────────────
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
            <li>• Bonne réponse en <b>moins de {FAST_S}s</b> : <span className="text-canal-yellow font-bold">+5 pts</span></li>
            <li>• Bonne réponse plus lente : <span className="text-canal-yellow font-bold">+3 pts</span></li>
            <li>• Mauvaise réponse ou temps écoulé : <span className="text-canal-gray-muted">0 pt</span></li>
            <li>• La bonne réponse est dévoilée à l&apos;écran à la fin du chrono.</li>
          </ul>
        </div>
      </div>
    );
  }

  const q = session.question;
  const rawElapsed = Date.now() - new Date(session.started_at).getTime();
  const inCountdown = session.phase === "countdown" || rawElapsed < 0;
  const isReveal = session.phase === "reveal";
  const countdownLeft = inCountdown ? Math.max(1, Math.ceil(-rawElapsed / 1000)) : 0;
  const elapsedMs = Math.max(0, rawElapsed);
  const timeLeft = Math.max(0, Math.ceil((TIMER_SECONDS * 1000 - elapsedMs) / 1000));
  const tooEarly = !inCountdown && rawElapsed < QUIZ_MIN_RESPONSE_MS;
  const timerPct = Math.max(0, (timeLeft / TIMER_SECONDS) * 100);
  const timerColor = timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-yellow-400" : "bg-canal-yellow";

  const getAnswerText = (key: string) =>
    ({ A: q.answer_a, B: q.answer_b, C: q.answer_c, D: q.answer_d }[key] ?? "");

  const wasAnswered = !!outcome;
  const locked = wasAnswered || submitting || isReveal || inCountdown || tooEarly;

  // ── Countdown : "3 / 2 / 1" ────────────────────────────────────────────────
  if (inCountdown) {
    return (
      <div className="px-4 py-4 max-w-2xl mx-auto flex flex-col gap-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-canal-gray-muted">
            Question <span className="text-white font-bold">{session.question_index + 1}</span>
            {session.total > 0 && <span> / {session.total}</span>}
          </span>
          <span className="text-xs uppercase tracking-wider text-canal-yellow font-black">Préparation…</span>
        </div>
        <div className="canal-card flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-canal-gray-muted text-sm uppercase tracking-wider">Prochaine question dans</p>
          <p key={countdownLeft} className="text-canal-yellow font-black text-8xl tabular-nums animate-pulse">
            {countdownLeft}
          </p>
          <p className="text-canal-gray-muted text-xs mt-2 italic">Mains sur les genoux 👀</p>
        </div>
      </div>
    );
  }

  // ── Reveal : le téléphone reste SOBRE (la TV est le spectacle). On affiche
  //    "Résultat enregistré → Regarde l'écran", puis seulement quand la TV a fini
  //    sa choré (~5s) on dévoile le gain perso "+X pts".
  if (isReveal) {
    const revealElapsed = elapsedMs - TIMER_SECONDS * 1000;
    const showPoints = revealElapsed > 5000;
    const pts = outcome?.points ?? 0;
    const answered = !!outcome && outcome.selected !== "";
    return (
      <div className="px-4 py-8 max-w-2xl mx-auto flex flex-col items-center justify-center gap-6 text-center min-h-[55vh]">
        {!showPoints ? (
          <>
            {answered ? (
              <CheckCircle className="text-canal-yellow" size={52} />
            ) : (
              <Hourglass className="text-canal-gray-muted" size={48} />
            )}
            <div>
              <p className="font-black text-white text-xl">
                {answered ? "Résultat enregistré" : "Temps écoulé"}
              </p>
              <p className="text-canal-gray-muted text-sm mt-2">Regarde l&apos;écran 📺</p>
            </div>
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-canal-yellow/70 animate-pulse" />
              <span className="w-2.5 h-2.5 rounded-full bg-canal-yellow/40 animate-pulse [animation-delay:150ms]" />
              <span className="w-2.5 h-2.5 rounded-full bg-canal-yellow/20 animate-pulse [animation-delay:300ms]" />
            </div>
          </>
        ) : (
          <>
            <p className="text-canal-gray-muted text-xs uppercase tracking-wider">Cette question</p>
            <p
              className={cn(
                "font-black tabular-nums leading-none",
                pts > 0 ? "text-green-400 text-7xl" : "text-canal-gray-muted text-6xl"
              )}
            >
              {pts > 0 ? `+${pts}` : "0"}
              <span className="text-2xl"> pts</span>
            </p>
            {pts === 5 && (
              <p className="flex items-center gap-1.5 text-canal-yellow text-sm font-bold">
                <Zap size={14} /> Bonus rapidité
              </p>
            )}
            <p className="text-canal-gray-muted text-xs mt-2">En attente de la question suivante…</p>
          </>
        )}
      </div>
    );
  }

  // ── Question active ────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-4 max-w-2xl mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-canal-gray-muted">
          Question <span className="text-white font-bold">{session.question_index + 1}</span>
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

      <div className="h-2 bg-canal-gray-mid rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-300", timerColor)} style={{ width: `${timerPct}%` }} />
      </div>

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

      <div className="grid grid-cols-1 gap-3">
        {ANSWERS.map((key) => {
          const text = getAnswerText(key);
          const isSelected = outcome?.selected === key;
          let btnClass = "canal-card flex items-center gap-3 w-full text-left transition-all";
          if (wasAnswered) {
            // On NE révèle PAS si c'est juste : seulement "sélectionné".
            btnClass += isSelected ? " border border-canal-yellow bg-canal-yellow/10" : " opacity-40";
          } else if (locked) {
            btnClass += " opacity-50";
          } else {
            btnClass += " hover:border-canal-yellow/50 hover:bg-canal-gray-mid active:scale-98";
          }
          return (
            <button key={key} onClick={() => submitAnswer(key)} disabled={locked} className={btnClass}>
              <span className="w-8 h-8 rounded-lg bg-canal-gray-light flex items-center justify-center font-black text-sm flex-shrink-0">
                {key}
              </span>
              <span className="flex-1 text-sm font-medium">{text}</span>
              {wasAnswered && isSelected && <CheckCircle size={18} className="text-canal-yellow flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Réponse enregistrée (suspense : pas de correct/faux avant le reveal) */}
      {wasAnswered && outcome?.selected !== "" && (
        <div className="canal-card text-center border border-canal-yellow/40 bg-canal-yellow/5">
          <p className="text-canal-yellow font-black text-base flex items-center justify-center gap-2">
            <CheckCircle size={16} /> Réponse enregistrée
          </p>
          <p className="text-canal-gray-muted text-xs mt-1">
            En attente… la bonne réponse s&apos;affiche à la fin du chrono.
          </p>
        </div>
      )}
    </div>
  );
}
