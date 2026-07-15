"use client";

// 🧠 Quiz SOLO — le même quiz, jouable seul depuis son écran après le lancement
// officiel. Chrono court (10s/question), score RÉDUIT (coefficient). Anti-rejeu :
// les questions déjà jouées (Live ou Solo) ne réapparaissent pas. La bonne
// réponse est dévoilée après chaque question (un seul joueur, pas de triche
// collective). Le classement championnat cumule ces points.

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Timer, CheckCircle, XCircle, Hourglass, Trophy, ArrowLeft } from "lucide-react";
import { QUIZ_SOLO_TIMER_SECONDS } from "@/lib/scoring";

const ANSWERS = ["A", "B", "C", "D"] as const;
const TIMER_MS = QUIZ_SOLO_TIMER_SECONDS * 1000;

interface SoloQuestion {
  id: string;
  question: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  category?: string;
  difficulty?: string;
}
interface Outcome {
  selected: string;
  is_correct: boolean;
  correct_answer?: string;
  explanation?: string;
  points: number;
  alreadyAnswered?: boolean;
}

export default function QuizSoloPage() {
  const [state, setState] = useState<"loading" | "unavailable" | "playing" | "done">("loading");
  const [reason, setReason] = useState<string | null>(null);
  const [queue, setQueue] = useState<SoloQuestion[]>([]);
  const [i, setI] = useState(0);
  const [coef, setCoef] = useState(0.5);
  const [scoringNote, setScoringNote] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, forceTick] = useState(0);
  const startedAt = useRef<number>(0);
  const timedOutFor = useRef<string | null>(null);

  // Charge l'état Solo : questions NON encore jouées.
  useEffect(() => {
    let alive = true;
    fetch("/api/quiz/solo", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (!d.available) { setReason(d.reason ?? null); setState("unavailable"); return; }
        setCoef(d.coefficient ?? 0.7);
        setScoringNote(typeof d.scoring_note === "string" ? d.scoring_note : null);
        const answered = new Set<string>(d.answered ?? []);
        const todo: SoloQuestion[] = (d.questions ?? []).filter((q: SoloQuestion) => !answered.has(q.id));
        setQueue(todo);
        if (todo.length === 0) { setState("done"); return; }
        startedAt.current = Date.now();
        setState("playing");
      })
      .catch(() => { if (alive) setState("unavailable"); });
    return () => { alive = false; };
  }, []);

  // Re-render 4×/s pour le chrono.
  useEffect(() => {
    if (state !== "playing") return;
    const t = setInterval(() => forceTick((v) => v + 1), 250);
    return () => clearInterval(t);
  }, [state]);

  const current = queue[i];

  const submit = useCallback(
    async (answer: string) => {
      if (!current || outcome || submitting) return;
      setSubmitting(true);
      const rt = Math.min(Date.now() - startedAt.current, TIMER_MS);
      try {
        const res = await fetch("/api/quiz/solo/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ question_id: current.id, answer, response_time_ms: rt }),
        });
        const d = await res.json().catch(() => ({}));
        const pts = typeof d.points === "number" ? d.points : 0;
        setOutcome({
          selected: answer,
          is_correct: !!d.is_correct,
          correct_answer: d.correct_answer,
          explanation: d.explanation,
          points: pts,
          alreadyAnswered: !!d.alreadyAnswered,
        });
        setScore((s) => s + pts);
        setAnsweredCount((n) => n + 1);
      } catch {
        setOutcome({ selected: answer, is_correct: false, points: 0 });
      }
      setSubmitting(false);
    },
    [current, outcome, submitting]
  );

  // Timeout auto (chrono écoulé sans réponse).
  useEffect(() => {
    if (state !== "playing" || !current || outcome) return;
    const left = TIMER_MS - (Date.now() - startedAt.current);
    if (left <= 0 && timedOutFor.current !== current.id) {
      timedOutFor.current = current.id;
      void submit("");
    }
  });

  const next = () => {
    setOutcome(null);
    if (i + 1 >= queue.length) { setState("done"); return; }
    setI((v) => v + 1);
    startedAt.current = Date.now();
  };

  const total = queue.length;
  const timeLeft = current ? Math.max(0, Math.ceil((TIMER_MS - (Date.now() - startedAt.current)) / 1000)) : 0;
  const answerText = (q: SoloQuestion, k: string) =>
    ({ A: q.answer_a, B: q.answer_b, C: q.answer_c, D: q.answer_d }[k] ?? "");
  const coefPct = useMemo(() => Math.round(coef * 100), [coef]);

  // ── États ──────────────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "unavailable") {
    const lockMsg =
      reason === "live_in_progress"
        ? "🔒 Le Quiz est actuellement en direct. Le mode Solo ouvrira à la fin du Live."
        : reason === "window_closed"
          ? "🔒 La fenêtre du Quiz Solo est fermée pour ce quiz. Rendez-vous au prochain !"
          : "🔒 Le Quiz Live n'a pas encore commencé. Le mode Solo ouvrira à la fin du Live.";
    return (
      <div className="px-4 py-8 max-w-2xl mx-auto flex flex-col items-center text-center gap-4 min-h-[55vh] justify-center">
        <Hourglass className="text-canal-yellow" size={40} />
        <h1 className="canal-headline text-2xl">Quiz Solo</h1>
        <p className="text-canal-gray-muted text-sm leading-relaxed max-w-md">
          {lockMsg}
        </p>
        <Link href="/quiz" className="mt-2 px-4 py-2 rounded-xl bg-canal-gray-mid border border-canal-gray-light text-white text-sm font-bold inline-flex items-center gap-2">
          <ArrowLeft size={15} /> Retour au Quiz
        </Link>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="px-4 py-8 max-w-2xl mx-auto flex flex-col items-center text-center gap-5 min-h-[55vh] justify-center">
        <Trophy className="text-canal-yellow" size={48} />
        <h1 className="canal-headline text-2xl">Quiz Solo terminé</h1>
        {answeredCount > 0 ? (
          <p className="text-white text-lg">
            Tu as marqué <span className="text-canal-yellow font-black text-2xl">+{score}</span> pts en solo.
          </p>
        ) : (
          <p className="text-canal-gray-muted text-sm">Tu as déjà répondu à toutes les questions disponibles.</p>
        )}
        <p className="text-canal-gray-muted text-xs">Points comptés au championnat (mode Solo : {coefPct}%).</p>
        <Link href="/quiz" className="mt-2 px-5 py-2.5 rounded-xl bg-canal-yellow text-canal-black font-black text-sm inline-flex items-center gap-2">
          <Trophy size={15} /> Voir le classement
        </Link>
      </div>
    );
  }

  // ── En jeu ─────────────────────────────────────────────────────────────────
  const q = current!;
  return (
    <div className="px-4 py-4 max-w-2xl mx-auto flex flex-col gap-5">
      {/* Bandeau Solo explicite : personne ne doit se croire désavantagé sans le savoir. */}
      <div className="rounded-xl border border-canal-yellow/30 bg-canal-yellow/5 px-3 py-2.5 text-xs leading-relaxed">
        <span className="font-black text-canal-yellow">🎮 Mode Solo</span>{" "}
        <span className="text-white/80">— même barème que le Live. Le mode <b>Live</b> reste le plus intense, mais pas plus rentable.</span>
        {scoringNote && <span className="block mt-1 text-white/60">{scoringNote}</span>}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-canal-gray-muted">
          Solo · <span className="text-white font-bold">{i + 1}</span> / {total}
          <span className="ml-2 text-[10px] uppercase tracking-wider text-canal-yellow/80 bg-canal-yellow/10 px-1.5 py-0.5 rounded-full">{coefPct}% des points</span>
        </span>
        {!outcome && (
          <span className={cn("flex items-center gap-1.5 font-black text-2xl tabular-nums", timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white")}>
            <Timer size={16} className={timeLeft <= 5 ? "text-red-400" : "text-canal-gray-muted"} />
            {timeLeft}s
          </span>
        )}
      </div>

      <div className="canal-card">
        {(q.category || q.difficulty) && (
          <span className="text-xs text-canal-gray-muted uppercase tracking-wider">
            {q.category}{q.category && q.difficulty ? " · " : ""}{q.difficulty}
          </span>
        )}
        <p className="font-bold text-white text-lg mt-2 leading-snug">{q.question}</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {ANSWERS.map((key) => {
          const text = answerText(q, key);
          const isSel = outcome?.selected === key;
          const isCorrect = outcome?.correct_answer === key;
          let btnClass = "canal-card flex items-center gap-3 w-full text-left transition-all";
          if (outcome) {
            if (isCorrect) btnClass += " border border-green-500 bg-green-500/10";
            else if (isSel) btnClass += " border border-red-500 bg-red-500/10";
            else btnClass += " opacity-40";
          } else {
            btnClass += " hover:border-canal-yellow/50 hover:bg-canal-gray-mid active:scale-98";
          }
          return (
            <button key={key} onClick={() => submit(key)} disabled={!!outcome || submitting} className={btnClass}>
              <span className="w-8 h-8 rounded-lg bg-canal-gray-light flex items-center justify-center font-black text-sm flex-shrink-0">{key}</span>
              <span className="flex-1 text-sm font-medium">{text}</span>
              {outcome && isCorrect && <CheckCircle size={18} className="text-green-400 flex-shrink-0" />}
              {outcome && isSel && !isCorrect && <XCircle size={18} className="text-red-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {outcome && (
        <div className="canal-card text-center space-y-2">
          <p className={cn("font-black text-lg flex items-center justify-center gap-2", outcome.is_correct ? "text-green-400" : "text-canal-gray-muted")}>
            {outcome.is_correct ? <><CheckCircle size={18} /> Bonne réponse · +{outcome.points} pts</> : <><XCircle size={18} /> Raté</>}
          </p>
          {outcome.alreadyAnswered && (
            <p className="text-orange-300 text-xs font-bold">Cette question ne rapporte plus de points.</p>
          )}
          {outcome.explanation && <p className="text-canal-gray-muted text-xs italic leading-relaxed">{outcome.explanation}</p>}
          <button onClick={next} className="mt-1 w-full py-3 rounded-xl bg-canal-yellow text-canal-black font-black text-sm">
            {i + 1 >= total ? "Terminer" : "Question suivante"}
          </button>
        </div>
      )}
    </div>
  );
}
