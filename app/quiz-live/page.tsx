"use client";

// Quiz Live SHOW (téléphone joueur). Le quiz s'enchaîne TOUT SEUL ; l'écran TV
// maître (/quiz-show) est le spectacle. Tous les joueurs voient la même question
// simultanément. Poll /api/quiz/session toutes les ~1s. Le chrono est CALCULÉ
// depuis session.started_at (UTC serveur) → synchronisé entre joueurs, sans dérive.
//
// Déroulé côté joueur :
//   1. countdown → "5 / 4 / 3 / 2 / 1"
//   2. question  → 4 réponses ; au clic : "Réponse enregistrée — en attente"
//      (on NE dit PAS encore si c'est juste : suspense jusqu'au reveal)
//   3. reveal    → "Temps écoulé", puis ton résultat perso, puis question suivante.
// L'organisateur (Vincent) ne peut que mettre en PAUSE / REPRENDRE.

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
      phase: "countdown" | "question" | "timeup" | "stats" | "answer";
      paused: boolean;
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
  // 🛡 Anti-triche : quitter l'app / changer d'onglet pendant une question.
  const [cheatWarn, setCheatWarn] = useState(false);
  const [cheatForfeit, setCheatForfeit] = useState(false);
  const leaveRef = useRef<{ qId: string | null; count: number }>({ qId: null, count: 0 });

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
            paused: !!d.paused,
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

  // Reset l'outcome local quand la question change (enchaînement auto)
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
      setCheatWarn(false);
      setCheatForfeit(false);
      leaveRef.current = { qId: session.question.id, count: 0 };
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
      if (submitting || cheatForfeit) return;
      if (outcome) {
        // Modification autorisée : un AUTRE choix, et UNIQUEMENT pendant le chrono
        // (phase "question"). Le timeout "" ne modifie jamais une réponse donnée.
        if (answer === "" || answer === outcome.selected || session.phase !== "question") return;
      }
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
    [session, outcome, submitting, cheatForfeit]
  );

  // Auto-submit "" (timeout) si l'utilisateur n'a pas répondu à temps.
  useEffect(() => {
    if (session.status !== "live") return;
    if (outcome || session.paused) return; // jamais pendant une pause
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
    if (session.status !== "live" || session.phase !== "question" || outcome || session.paused) return;
    const left = TIMER_SECONDS * 1000 - (Date.now() - new Date(session.started_at).getTime());
    if (left <= 3000 && left > 0 && vibratedRef.current !== session.question.id) {
      vibratedRef.current = session.question.id;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([90, 60, 90, 60, 160]);
      }
    }
  });

  // 🛡 Anti-triche : quitter l'app ou changer d'onglet pendant une question
  // OUVERTE (chrono en cours, pas encore répondu, hors pause) = 1er écart →
  // avertissement, 2e écart → forfait (0 pt). On ne réagit qu'à un VRAI départ
  // (document.hidden), ce qui écarte les faux positifs d'un simple clic/blur.
  useEffect(() => {
    if (session.status !== "live" || session.phase !== "question" || outcome || session.paused) return;
    const qId = session.question.id;
    const onHide = () => {
      if (typeof document === "undefined" || !document.hidden) return;
      if (leaveRef.current.qId !== qId) leaveRef.current = { qId, count: 0 };
      leaveRef.current.count += 1;
      if (leaveRef.current.count >= 2) {
        if (autoTimeoutFiredRef.current !== qId) {
          autoTimeoutFiredRef.current = qId;
          setCheatForfeit(true);
          void submitAnswer(""); // forfait : 0 pt sur cette question
        }
      } else {
        setCheatWarn(true); // 1er écart : avertissement (visible au retour)
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [session, outcome, submitAnswer]);

  // ── Idle : pas de session active ───────────────────────────────────────────
  if (session.status === "idle") {
    return (
      <div className="px-4 py-8 max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="canal-headline text-2xl">Quiz Live ⚡</h1>
          <p className="text-canal-gray-muted text-sm mt-1">
            Le quiz est lancé par l&apos;organisateur — reste sur cette page.
          </p>
        </div>

        <div className="canal-card text-center py-8">
          <Hourglass className="mx-auto text-canal-yellow mb-3" size={32} />
          <p className="font-black text-white text-lg">En attente du quiz…</p>
          <p className="text-canal-gray-muted text-sm mt-2 leading-relaxed">
            Quand l&apos;organisateur lancera le quiz, les questions apparaîtront ici
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
            <li>• <span className="text-red-300 font-bold">🚫 Anti-triche</span> : si vous <b>changez d&apos;application ou d&apos;écran</b> pendant une question, l&apos;appli le détecte — 1 avertissement, puis la <b>question est perdue</b> (0 pt).</li>
          </ul>
        </div>
      </div>
    );
  }

  const q = session.question;
  const paused = session.paused;
  const rawElapsed = Date.now() - new Date(session.started_at).getTime();
  const inCountdown = session.phase === "countdown" || rawElapsed < 0;
  // Après le chrono : timeup = « regarde l'écran », answer = résultat perso dévoilé.
  const isReveal = ["timeup", "stats", "answer"].includes(session.phase);
  const resultRevealed = session.phase === "answer";
  const countdownLeft = inCountdown ? Math.max(1, Math.ceil(-rawElapsed / 1000)) : 0;
  const elapsedMs = Math.max(0, rawElapsed);
  const timeLeft = Math.max(0, Math.ceil((TIMER_SECONDS * 1000 - elapsedMs) / 1000));
  const tooEarly = !inCountdown && rawElapsed < QUIZ_MIN_RESPONSE_MS;
  const timerPct = Math.max(0, (timeLeft / TIMER_SECONDS) * 100);
  const timerColor = timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-yellow-400" : "bg-canal-yellow";

  const getAnswerText = (key: string) =>
    ({ A: q.answer_a, B: q.answer_b, C: q.answer_c, D: q.answer_d }[key] ?? "");

  const wasAnswered = !!outcome;
  // On NE verrouille PAS sur wasAnswered : tant que le chrono tourne (phase
  // "question"), on peut CHANGER sa réponse. Verrouillé au reveal / countdown /
  // pause / trop tôt / forfait anti-triche.
  const locked = submitting || isReveal || inCountdown || tooEarly || paused || cheatForfeit;

  // ── Pause : l'organisateur a figé le quiz ──────────────────────────────────
  if (paused) {
    return (
      <div className="px-4 py-8 max-w-2xl mx-auto flex flex-col items-center justify-center gap-5 text-center min-h-[55vh]">
        <p className="text-6xl">⏸</p>
        <p className="font-black text-white text-2xl">Pause</p>
        <p className="text-canal-gray-muted text-sm">
          L&apos;organisateur a mis le quiz en pause.
          <br />
          Ça reprend dans un instant — garde cette page ouverte.
        </p>
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-canal-yellow/70 animate-pulse" />
          <span className="w-2.5 h-2.5 rounded-full bg-canal-yellow/40 animate-pulse [animation-delay:150ms]" />
          <span className="w-2.5 h-2.5 rounded-full bg-canal-yellow/20 animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

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
    const showPoints = resultRevealed; // dévoilé quand l'écran montre la bonne réponse
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
                {answered ? "Résultat enregistré" : cheatForfeit ? "Écran quitté — 0 pt" : "Temps écoulé"}
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
            {cheatForfeit && (
              <p className="text-red-300 text-xs font-bold">Tu as quitté l&apos;écran pendant la question.</p>
            )}
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

  // ── 🛡 Avertissement anti-triche (1er écart, pas encore répondu) ────────────
  if (cheatWarn && !wasAnswered) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ background: "rgba(90,0,0,0.96)" }}
      >
        <p className="text-6xl">⚠️</p>
        <p className="font-black text-white text-2xl">Reste sur le quiz !</p>
        <p className="text-white/85 text-sm leading-relaxed">
          Quitter l&apos;application ou changer d&apos;onglet pendant une question, c&apos;est interdit.
          <br />
          Au prochain écart sur cette question : <b className="text-red-300">0 point</b>.
        </p>
        <button
          onClick={() => setCheatWarn(false)}
          className="mt-1 px-6 py-3 rounded-xl bg-canal-yellow text-canal-black font-black active:scale-95 transition-transform"
        >
          J&apos;ai compris — je réponds
        </button>
        <p className="text-white/50 text-xs">Il te reste {timeLeft}s</p>
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
            // On NE révèle PAS si c'est juste : "sélectionné". Les autres restent
            // CLIQUABLES (on peut changer tant que le chrono tourne).
            btnClass += isSelected
              ? " border border-canal-yellow bg-canal-yellow/10"
              : " opacity-60 hover:opacity-100 hover:border-canal-yellow/40 hover:bg-canal-gray-mid active:scale-98";
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
            Tu peux encore <b className="text-white">changer</b> tant que le chrono tourne.
          </p>
        </div>
      )}
    </div>
  );
}
