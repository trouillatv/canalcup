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

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  phase: "countdown" | "question" | "timeup" | "stats" | "answer" | "leaderboard";
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
  standings?: Standing[];
}
interface Standing {
  name: string;
  points: number;
  correct: number;
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

// ─── Colonne de podium (cérémonie de fin) ─────────────────────────────────────
function PodiumCol({
  show, medal, player, h, accent, big,
}: { show: boolean; medal: string; player?: Standing; h: string; accent: string; big?: boolean }) {
  return (
    <div className={`flex-1 max-w-[34%] flex flex-col items-center justify-end transition-all duration-700 ${show && player ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
      {player && (
        <>
          <span className={`mb-1 ${big ? "text-4xl sm:text-7xl" : "text-3xl sm:text-5xl"}`}>{medal}</span>
          <span className={`font-black ${accent} text-base sm:text-3xl text-center truncate w-full px-1`}>{player.name}</span>
          <span className="text-white/50 text-xs sm:text-xl mb-2 tabular-nums">{player.points} pts</span>
        </>
      )}
      <div className={`w-full ${h} rounded-t-xl border-t border-white/20 bg-gradient-to-b ${big ? "from-canal-yellow/40 to-canal-yellow/0" : "from-white/15 to-white/0"}`} />
    </div>
  );
}

// 🤖 Robert, maître de cérémonie : une pique selon le résultat collectif.
// Déterministe (pas de LLM) et parcimonieux (≈ 1 question sur 3).
function robertLine(correctCount: number, responded: number, wrongPct: number, difficulty?: string): string {
  if (responded > 0 && correctCount === 0) return "Vous êtes tombés dans le piège. 🪤";
  if (responded > 0 && correctCount === responded) return "Trop facile pour vous, visiblement.";
  if (correctCount === 1) return "Un seul petit génie a trouvé. Chapeau.";
  if (wrongPct >= 70) return "Cette question était pourtant simple…";
  if (difficulty === "hard") return "Pas mal, pour une question piège.";
  return "Intéressant. Très intéressant.";
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function QuizShowPage() {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [finished, setFinished] = useState<{ standings: Standing[] } | null>(null);
  const [idle, setIdle] = useState(true);
  const [, forceTick] = useState(0);
  const cancelled = useRef(false);

  // Rythme PILOTÉ par l'animateur : la phase vient du serveur (countdown →
  // question → timeup → stats → answer → leaderboard), plus de timers auto.
  const phase = session?.phase;
  const currentQId = session?.question.id ?? null;

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

  // Tics : 3·2·1 avant la question, puis chrono 1 tic/s de 5s→2s, et un tic-tac
  // ACCÉLÉRÉ (toutes les ~300 ms) dans les 2 dernières secondes — mode panique.
  const startedAt = session?.started_at;
  useEffect(() => {
    if (!startedAt) return;
    const startMs = new Date(startedAt).getTime();
    let lastCountdownSec = -1;
    let lastTickAt = 0;
    const iv = setInterval(() => {
      const el = Date.now() - startMs;
      if (el < 0) {
        const left = Math.ceil(-el / 1000);
        if (left >= 1 && left <= 3 && left !== lastCountdownSec) {
          lastCountdownSec = left;
          if (soundOnRef.current) sfx.tick(3 - left);
        }
      } else if (el < QUIZ_TIMER_SECONDS * 1000) {
        const remaining = QUIZ_TIMER_SECONDS * 1000 - el;
        const cadence = remaining <= 2000 ? 300 : remaining <= 5000 ? 1000 : 0;
        if (cadence && Date.now() - lastTickAt >= cadence) {
          lastTickAt = Date.now();
          const level = remaining <= 1000 ? 4 : remaining <= 2000 ? 3 : remaining <= 3500 ? 2 : 1;
          if (soundOnRef.current) sfx.tick(level);
        }
      }
    }, 100);
    return () => clearInterval(iv);
  }, [startedAt]);

  // Sons aux transitions d'étape (pilotées par l'animateur) : buzzer au temps
  // écoulé, son de reveal aux stats, arpège sur la bonne réponse, « up » au classement.
  const prevPhaseRef = useRef<string>("");
  useEffect(() => {
    const p = phase ?? "";
    if (!p || p === prevPhaseRef.current) return;
    prevPhaseRef.current = p;
    if (!soundOnRef.current) return;
    if (p === "timeup") sfx.buzzer();
    else if (p === "stats") sfx.reveal();
    else if (p === "leaderboard") sfx.rankUp();
    // 'answer' : le son (arpège) est joué au BOOM, pas à l'entrée (cf. effet ci-dessous).
  }, [phase]);

  // 🥁→💥 Révélation de la réponse : roulement (drumroll) puis boom. Pendant le
  // drumroll le bon n'est pas encore allumé (micro-attente). Un résultat notable
  // (personne / 100% / 1 seul) déclenche un événement PLEIN ÉCRAN.
  const [answerSub, setAnswerSub] = useState<0 | 1>(0); // 0 = drumroll, 1 = boom
  const [statEvent, setStatEvent] = useState<{ emoji: string; line: string } | null>(null);
  const answerForQ = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "answer" || !currentQId) {
      answerForQ.current = null;
      setAnswerSub(0);
      setStatEvent(null);
      return;
    }
    if (answerForQ.current === currentQId) return;
    answerForQ.current = currentQId;
    setAnswerSub(0);
    setStatEvent(null);
    const d = session?.distribution;
    const corr = session?.correct_answer as "A" | "B" | "C" | "D" | undefined;
    const resp = session?.responded ?? 0;
    const cc = corr && d ? d[corr] : 0;
    let ev: { emoji: string; line: string } | null = null;
    if (resp > 0 && cc === 0) ev = { emoji: "😱", line: "PERSONNE n'a trouvé !" };
    else if (resp > 0 && cc === resp) ev = { emoji: "🔥", line: "100 % de bonnes réponses !" };
    else if (cc === 1) ev = { emoji: "⚡", line: "Une seule personne a trouvé !" };
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => {
        setAnswerSub(1);
        if (soundOnRef.current) sfx.correct();
        if (ev) setStatEvent(ev);
      }, 1300),
    ];
    if (ev) timers.push(setTimeout(() => setStatEvent(null), 4200));
    return () => timers.forEach(clearTimeout);
  }, [phase, currentQId, session]);

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

  // 🏆 Cérémonie de fin : stages 0→5 (intro → 3e → 2e → 1er+confettis → photo →
  // classement complet + merci). Joue la fanfare sur le 1er.
  const [ceremonyStage, setCeremonyStage] = useState(0);
  const ceremonyStarted = useRef(false);
  useEffect(() => {
    if (!finished) {
      ceremonyStarted.current = false;
      setCeremonyStage(0);
      return;
    }
    if (ceremonyStarted.current) return;
    ceremonyStarted.current = true;
    setCeremonyStage(0);
    const t = [
      setTimeout(() => setCeremonyStage(1), 1200),
      setTimeout(() => setCeremonyStage(2), 3400),
      setTimeout(() => { setCeremonyStage(3); if (soundOnRef.current) sfx.fanfare(); }, 5600),
      setTimeout(() => setCeremonyStage(4), 9500),
      setTimeout(() => setCeremonyStage(5), 12500),
    ];
    return () => t.forEach(clearTimeout);
  }, [finished]);

  // Confettis : positions déterministes (pas de Math.random → pas de mismatch SSR).
  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 10) * 0.18,
        dur: 2.4 + (i % 5) * 0.4,
        color: ["#FFD400", "#2563eb", "#7c3aed", "#f97316", "#22c55e"][i % 5],
        size: 6 + (i % 4) * 3,
        rot: (i * 53) % 360,
      })),
    []
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
          setFinished(null);
          setIdle(false);
        } else if (d.status === "finished" && Array.isArray(d.standings) && d.standings.length) {
          setFinished({ standings: d.standings as Standing[] });
          setSession(null);
          setIdle(false);
        } else {
          setSession(null);
          setFinished(null);
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

  // ── 🏆 Cérémonie de fin ─────────────────────────────────────────────────────
  if (finished) {
    const s = finished.standings;
    const showConfetti = ceremonyStage >= 3;
    return (
      <PinGate>
        <div className="fixed inset-0 flex flex-col items-center justify-center px-4 select-none overflow-hidden" style={{ background: WARM_BG }}>
          {showConfetti && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {confetti.map((c, i) => (
                <span
                  key={i}
                  className="absolute top-[-5%] rounded-sm"
                  style={{
                    left: `${c.left}%`,
                    width: c.size,
                    height: c.size * 1.6,
                    background: c.color,
                    animation: `confettiFall ${c.dur}s linear ${c.delay}s infinite`,
                  }}
                />
              ))}
            </div>
          )}

          {ceremonyStage < 5 ? (
            <div className="relative flex flex-col items-center gap-8 sm:gap-14 w-full max-w-4xl">
              <p className="font-black text-3xl sm:text-7xl text-canal-yellow uppercase tracking-widest" style={{ animation: "fadeUp .5s both" }}>
                🏆 Résultats
              </p>
              <div className="flex items-end justify-center gap-3 sm:gap-6 w-full">
                <PodiumCol show={ceremonyStage >= 2} medal="🥈" player={s[1]} h="h-36 sm:h-56" accent="text-white/85" />
                <PodiumCol show={ceremonyStage >= 3} medal="🥇" player={s[0]} h="h-52 sm:h-80" accent="text-canal-yellow" big />
                <PodiumCol show={ceremonyStage >= 1} medal="🥉" player={s[2]} h="h-28 sm:h-44" accent="text-orange-300" />
              </div>
              {ceremonyStage >= 4 && (
                <p className="font-black text-xl sm:text-4xl text-white" style={{ animation: "pop .5s both" }}>
                  📸 Photo de groupe !
                </p>
              )}
            </div>
          ) : (
            <div className="relative w-full max-w-2xl flex flex-col gap-3" style={{ animation: "fadeUp .5s both" }}>
              <p className="font-black text-2xl sm:text-5xl text-canal-yellow text-center uppercase tracking-widest mb-1">Classement final</p>
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[62vh]">
                {s.map((p, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 sm:gap-4 rounded-xl px-3 sm:px-5 py-2 sm:py-3 ${i === 0 ? "bg-canal-yellow/15 border border-canal-yellow/40" : "bg-white/5"}`}
                  >
                    <span className={`font-black tabular-nums w-7 sm:w-12 text-center text-lg sm:text-3xl ${i === 0 ? "text-canal-yellow" : i < 3 ? "text-white" : "text-white/40"}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 font-bold text-white text-base sm:text-2xl truncate">
                      {i < 3 ? `${["🥇", "🥈", "🥉"][i]} ` : ""}
                      {p.name}
                    </span>
                    <span className="text-white/40 text-xs sm:text-lg tabular-nums">{p.correct} ✓</span>
                    <span className="font-black text-canal-yellow tabular-nums text-base sm:text-2xl w-16 sm:w-24 text-right">{p.points} pts</span>
                  </div>
                ))}
              </div>
              <p className="text-center text-white/60 text-base sm:text-3xl font-bold mt-2">Merci à tous 🙏</p>
            </div>
          )}
          {soundBtn}
        </div>
      </PinGate>
    );
  }

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
  const ph = session.phase; // countdown | question | timeup | stats | answer | leaderboard
  const rawElapsed = Date.now() - new Date(session.started_at).getTime();
  const inCountdown = ph === "countdown" || rawElapsed < 0;
  const isTimeup = ph === "timeup";
  const isStats = ph === "stats";
  const isAnswer = ph === "answer";
  const isLeaderboard = ph === "leaderboard";
  const showOptions = ph === "question" || isTimeup; // grille des 4 réponses
  const countdownLeft = Math.max(1, Math.ceil(-rawElapsed / 1000));
  const elapsedMs = Math.max(0, rawElapsed);
  const timeLeft = Math.max(0, Math.ceil((QUIZ_TIMER_SECONDS * 1000 - elapsedMs) / 1000));
  const timerPct = Math.max(0, (timeLeft / QUIZ_TIMER_SECONDS) * 100);
  const timerColor =
    timeLeft <= 2 ? "bg-red-500" : timeLeft <= 3 ? "bg-orange-500" : timeLeft <= 5 ? "bg-yellow-400" : "bg-canal-yellow";
  // 🚨 Mode panique : 10% du temps restant (≤ 2s) → vignette rouge + chrono géant.
  const panic = ph === "question" && timeLeft > 0 && timeLeft <= 2;
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
        {/* 🚨 Vignette rouge clignotante des 2 dernières secondes */}
        {panic && (
          <div
            className="pointer-events-none fixed inset-0 z-30"
            style={{
              animation: "panicFlash .55s ease-in-out infinite",
              background: "radial-gradient(ellipse at center, rgba(190,0,0,0) 38%, rgba(210,0,0,0.42) 100%)",
            }}
          />
        )}
        {/* 💥 Événement plein écran (résultat notable) */}
        {statEvent && (
          <div
            className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 sm:gap-8 px-4"
            style={{ background: "rgba(8,6,4,0.88)", animation: "fadeUp .3s both" }}
          >
            <div className="text-4xl sm:text-8xl tracking-widest" style={{ animation: "pop .5s ease-out both" }}>
              {statEvent.emoji.repeat(5)}
            </div>
            <p className="font-black text-4xl sm:text-8xl text-canal-yellow text-center uppercase tracking-wide" style={{ animation: "pop .6s ease-out both", animationDelay: "0.1s" }}>
              {statEvent.line}
            </p>
          </div>
        )}
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

          {showOptions ? (
            // — Question / Temps écoulé : 4 cartouches colorées (grisées au timeup) —
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 max-w-6xl mx-auto w-full transition-opacity ${isTimeup ? "opacity-40" : ""}`}>
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
          ) : isLeaderboard ? (
            // — Classement (mouvements à venir, slice suivante) —
            <div className="max-w-2xl mx-auto w-full flex flex-col gap-2.5" style={{ animation: "fadeUp .4s both" }}>
              <p className="font-black text-2xl sm:text-5xl text-canal-yellow text-center uppercase tracking-widest mb-1">Classement</p>
              {(session.standings ?? []).slice(0, 8).map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 sm:gap-4 rounded-xl px-3 sm:px-5 py-2 sm:py-3 ${i === 0 ? "bg-canal-yellow/15 border border-canal-yellow/40" : "bg-white/5"}`}
                  style={{ animation: "fadeUp .4s both", animationDelay: `${i * 0.08}s` }}
                >
                  <span className={`font-black tabular-nums w-7 sm:w-12 text-center text-lg sm:text-3xl ${i === 0 ? "text-canal-yellow" : i < 3 ? "text-white" : "text-white/40"}`}>{i + 1}</span>
                  <span className="flex-1 font-bold text-white text-base sm:text-2xl truncate">{i < 3 ? `${["🥇", "🥈", "🥉"][i]} ` : ""}{p.name}</span>
                  <span className="font-black text-canal-yellow tabular-nums text-base sm:text-2xl w-16 sm:w-24 text-right">{p.points} pts</span>
                </div>
              ))}
            </div>
          ) : (
            // — Stats / Answer : répartition des votes —
            <div className="max-w-5xl mx-auto w-full flex flex-col gap-4 sm:gap-6">
              <div className="flex items-center justify-center gap-3 sm:gap-6 text-center" style={{ animation: "fadeUp .4s both" }}>
                <span className="text-white font-black text-xl sm:text-4xl tabular-nums">{responded} / {participants}</span>
                <span className="text-white/40 font-bold text-base sm:text-2xl">joueurs</span>
                <span className="text-canal-yellow font-black text-2xl sm:text-5xl tabular-nums">{respondedPct}%</span>
              </div>

              <div className="flex flex-col gap-2.5 sm:gap-3.5">
                {ANSWER_KEYS.map((key, i) => {
                  const palette = ANSWER_PALETTE[key];
                  const pct = pctOf(key);
                  const lit = isAnswer && answerSub === 1 && key === correct; // s'allume au BOOM
                  return (
                    <div key={key} className="flex items-center gap-3 sm:gap-5" style={{ animation: "fadeUp .4s both", animationDelay: `${i * 0.1}s` }}>
                      <span className={`font-black text-xl sm:text-3xl w-12 sm:w-24 text-center shrink-0 transition-colors ${lit ? "text-green-400" : "text-white/40"}`}>
                        {lit ? `✓ ${key}` : key}
                      </span>
                      <div className="flex-1 h-9 sm:h-14 bg-white/5 rounded-xl overflow-hidden relative">
                        <div
                          className={`h-full rounded-xl transition-colors duration-300 ${lit ? "bg-green-500" : palette.bar} ${isAnswer && answerSub === 1 && key !== correct ? "opacity-40" : "opacity-80"}`}
                          style={{ width: `${Math.max(pct, 3)}%`, transformOrigin: "left", animation: "growX .6s ease-out both", animationDelay: `${i * 0.1}s` }}
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

              {/* Suspense (stats) ou drumroll final (answer avant le boom) */}
              {(isStats || (isAnswer && answerSub === 0)) && (
                <p className="text-center text-white/60 font-black text-xl sm:text-4xl uppercase tracking-widest animate-pulse">
                  🥁🥁🥁 La bonne réponse est…
                </p>
              )}

              {/* 💥 BOOM : bonne réponse + explication + punchline + Robert */}
              {isAnswer && answerSub === 1 && correct && (
                <div className="flex flex-col items-center gap-3 sm:gap-4">
                  <p className="text-green-400 font-black text-3xl sm:text-6xl inline-flex items-center justify-center gap-3 flex-wrap" style={{ animation: "pop .55s ease-out both" }}>
                    💥 <span className="text-white/50">{correct}</span> {answerText(correct)}
                  </p>
                  {session.explanation && (
                    <p className="text-white/55 text-sm sm:text-2xl italic text-center max-w-3xl mx-auto leading-snug" style={{ animation: "fadeUp .5s both", animationDelay: "0.2s" }}>{session.explanation}</p>
                  )}
                  <div className="flex items-center justify-center gap-4 sm:gap-10 flex-wrap" style={{ animation: "fadeUp .5s both", animationDelay: "0.4s" }}>
                    <span className="text-white/70 font-bold text-base sm:text-3xl">{funnyStat}</span>
                    {fastest && (
                      <span className="flex items-center gap-2 text-canal-yellow font-black text-base sm:text-3xl">
                        ⚡ {fastest.name} <span className="text-white/50 tabular-nums">{(fastest.ms / 1000).toFixed(2)}s</span>
                      </span>
                    )}
                  </div>
                  {/* 🤖 Robert, maître de cérémonie — ≈ 1 question sur 3 */}
                  {session.question_index % 3 === 2 && (
                    <div className="mt-1 sm:mt-3 flex items-center gap-3 sm:gap-4 bg-white/5 border border-white/10 rounded-2xl px-4 sm:px-6 py-2.5 sm:py-3 max-w-2xl" style={{ animation: "fadeUp .5s both", animationDelay: "0.6s" }}>
                      <span className="text-2xl sm:text-4xl shrink-0">🤖</span>
                      <div className="min-w-0">
                        <span className="block text-canal-yellow font-black text-xs sm:text-base tracking-wider">ROBERT</span>
                        <span className="text-white/85 italic text-sm sm:text-2xl">« {robertLine(correctCount, responded, wrongPct, q.difficulty)} »</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer : chrono (question), « Temps écoulé » (timeup) ou consigne (reveal) */}
        <footer className="shrink-0 px-4 sm:px-12 pb-5 sm:pb-8 pt-3 sm:pt-4 border-t border-white/5">
          {ph === "question" ? (
            <div className="flex items-center gap-3 sm:gap-5">
              <span
                key={timeLeft <= 3 ? `t${timeLeft}` : "calm"}
                className={`font-black tabular-nums text-right transition-all ${panic ? "text-5xl sm:text-8xl w-20 sm:w-40" : "text-3xl sm:text-6xl w-16 sm:w-28"} ${
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
          ) : isTimeup ? (
            <p className="text-center font-black text-2xl sm:text-5xl text-red-400 uppercase tracking-widest" style={{ animation: "pop .5s both" }}>
              ⏱ Temps écoulé
            </p>
          ) : (
            <p className="text-white/35 text-center text-sm sm:text-2xl">
              {responded} réponse{responded > 1 ? "s" : ""} · l&apos;animateur poursuit le show
            </p>
          )}
        </footer>
      </div>
      {soundBtn}
    </PinGate>
  );
}
