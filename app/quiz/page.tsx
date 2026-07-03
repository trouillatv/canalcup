"use client";

// 🧠⚡ Hub Quiz CanalCup — championnat sur toute la CdM :
//  - Quiz Live (officiel, salle, 100 %) → /quiz-live ;
//  - Quiz Solo (à distance, points réduits) — VERROUILLÉ tant que le Live n'est
//    pas terminé, et ouvert dans une fenêtre limitée → /quiz/solo ;
//  - Section Finale (qualifiés actuels + quiz restants) ;
//  - Classement du dernier quiz (Live) + Classement championnat (cumul).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Trophy, Radio, Medal, Crown, ChevronRight, Sparkles, Lock, CheckCircle2, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuizPlayerDetail } from "@/components/quiz/QuizPlayerDetail";
import { QuizReview } from "@/components/quiz/QuizReview";

interface RankRow {
  user_id: string; name: string; points: number; correct: number; answered: number;
  rank: number; qualified?: boolean; isMe: boolean;
}
interface SchedItem { n: number; label: string; dateLabel: string }
interface Board {
  ranking: RankRow[];
  current: RankRow[];
  currentSessionStatus: string | null;
  finishedSessions: number;
  plannedQuizzes: number;
  finalists: number;
  qualifClosed: boolean;
  finale: { enabled: boolean; dateLabel: string; timeLabel: string; title: string };
  schedule: SchedItem[];
  viewerIsAdmin?: boolean;
}

const SOLO_LOCK: Record<string, string> = {
  not_started: "🔒 Le Quiz Live n'a pas encore commencé.",
  live_in_progress: "🔒 Le Quiz est actuellement en direct.",
  window_closed: "🔒 Le mode Solo de ce quiz est terminé.",
  played_live: "✅ Tu as joué le Live — le Solo est réservé à ceux qui n'ont pas pu participer.",
};
const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];

export default function QuizHubPage() {
  const [liveActive, setLiveActive] = useState(false);
  const [solo, setSolo] = useState<{ available: boolean; reason: string | null }>({ available: false, reason: null });
  const [board, setBoard] = useState<Board | null>(null);
  const [detail, setDetail] = useState<{ id: string; name: string } | null>(null);
  const [review, setReview] = useState(false);

  useEffect(() => {
    const load = () => {
      fetch("/api/quiz/session", { credentials: "same-origin" })
        .then((r) => r.json()).then((d) => setLiveActive(d.status === "question")).catch(() => {});
      fetch("/api/quiz/solo", { credentials: "same-origin" })
        .then((r) => r.json()).then((d) => setSolo({ available: !!d.available, reason: d.reason ?? null })).catch(() => {});
      fetch("/api/quiz/leaderboard", { credentials: "same-origin" })
        .then((r) => r.json()).then((d) => setBoard(d as Board)).catch(() => {});
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const finale = board?.finale;
  const finalists = board?.finalists ?? 5;
  const qualifiers = (board?.ranking ?? []).filter((r) => r.qualified);

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto pb-24">
      <div>
        <h1 className="canal-headline text-2xl flex items-center gap-2">
          <Brain className="text-canal-yellow" size={24} /> Championnat Quiz
        </h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Un championnat sur toute la Coupe du Monde — qui finit par une grande finale.
        </p>
      </div>

      {/* Quiz Live en direct */}
      {liveActive && (
        <Link href="/quiz-live" className="block rounded-2xl border border-red-500/40 bg-red-950/20 p-4 hover:bg-red-950/30 transition-colors">
          <div className="flex items-center gap-3">
            <Radio className="text-red-400 animate-pulse shrink-0" size={26} />
            <div className="min-w-0 flex-1">
              <p className="text-red-400 font-black text-lg">🔴 Quiz en direct !</p>
              <p className="text-white/70 text-sm">Rejoins le Live et réponds sur ton téléphone — 100 % des points.</p>
            </div>
            <ChevronRight className="text-red-400 shrink-0" size={20} />
          </div>
        </Link>
      )}

      {/* Choix de mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/quiz-live" className="canal-card hover:border-canal-yellow/50 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Radio size={16} className="text-canal-yellow" />
            <span className="font-black text-white">Quiz Live</span>
            <span className="ml-auto text-[10px] font-black text-canal-yellow bg-canal-yellow/10 px-1.5 py-0.5 rounded-full uppercase">100%</span>
          </div>
          <p className="text-canal-gray-muted text-xs leading-relaxed">En salle, écran projeté, animé par l&apos;organisateur. Le mode officiel qui crée l&apos;ambiance.</p>
        </Link>

        {solo.available ? (
          <Link href="/quiz/solo" className="canal-card border-canal-yellow/40 hover:border-canal-yellow transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Brain size={16} className="text-canal-yellow" />
              <span className="font-black text-white">Quiz Solo</span>
              <span className="ml-auto text-[10px] font-black text-canal-black bg-canal-yellow px-1.5 py-0.5 rounded-full uppercase">Ouvert</span>
            </div>
            <p className="text-canal-gray-muted text-xs leading-relaxed">À distance, à ton rythme. Points réduits — fenêtre limitée, joue tant que c&apos;est ouvert.</p>
          </Link>
        ) : (
          <div className="canal-card opacity-70">
            <div className="flex items-center gap-2 mb-1">
              <Lock size={15} className="text-canal-gray-muted" />
              <span className="font-black text-white/80">Quiz Solo</span>
              <span className="ml-auto text-[10px] font-black text-white/60 bg-white/10 px-1.5 py-0.5 rounded-full uppercase">Verrouillé</span>
            </div>
            <p className="text-canal-gray-muted text-xs leading-relaxed">
              {SOLO_LOCK[solo.reason ?? ""] ?? "🔒 Indisponible pour le moment."}
              <br />Le Solo ouvre <b>à la fin du Live</b> (points réduits).
            </p>
          </div>
        )}
      </div>

      {/* 🏆 Finale Quiz — qualifiés actuels */}
      {finale?.enabled && (
        <section className="rounded-2xl border border-canal-yellow/30 bg-gradient-to-b from-canal-yellow/10 to-transparent p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-canal-yellow" />
            <span className="font-black text-canal-yellow uppercase tracking-wide text-sm">{finale.title}</span>
            <span className="ml-auto text-white/70 text-xs font-bold">{finale.dateLabel} · {finale.timeLabel}</span>
          </div>

          <div>
            <p className="text-white/60 text-xs uppercase tracking-wider font-bold mb-1.5">
              {board?.qualifClosed ? "Finalistes" : "Qualifiés actuels"}
            </p>
            {qualifiers.length === 0 ? (
              <p className="text-canal-gray-muted text-sm italic">Les {finalists} premiers du classement se qualifieront.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {qualifiers.map((r) => (
                  <div key={r.user_id} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5", r.isMe ? "bg-canal-yellow/15" : "bg-white/5")}>
                    <span className="text-lg w-6 text-center">{MEDALS[r.rank - 1] ?? r.rank}</span>
                    <span className="flex-1 font-bold text-white text-sm truncate">{r.name}{r.isMe && <span className="text-canal-yellow text-xs"> · toi</span>}</span>
                    <span className="font-black text-canal-yellow tabular-nums text-sm">{r.points} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Saison Quiz */}
      {board && board.schedule.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">🗓️ Saison Quiz</h2>
          <div className="flex flex-wrap gap-2">
            {board.schedule.map((q, i) => {
              const done = i < board.finishedSessions;
              return (
                <span key={q.n} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border", done ? "bg-green-500/10 border-green-500/30 text-green-300" : "bg-white/5 border-canal-gray-light text-canal-gray-muted")}>
                  {done ? <CheckCircle2 size={13} /> : <Hourglass size={13} />}
                  {q.label} <span className="opacity-60">{q.dateLabel}</span>
                </span>
              );
            })}
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black border bg-canal-yellow/10 border-canal-yellow/30 text-canal-yellow">
              🏆 Grande Finale
            </span>
          </div>
        </section>
      )}

      {/* Classement du DERNIER quiz (Live) */}
      {board && board.current.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Radio size={15} className="text-canal-yellow" />
            <h2 className="font-black text-white text-sm">
              {board.currentSessionStatus === "question" ? "Quiz en cours" : "Dernier quiz"}
            </h2>
          </div>
          <div className="flex flex-col gap-1">
            {board.current.slice(0, 5).map((r) => (
              <div key={r.user_id} className={cn("flex items-center gap-3 rounded-lg px-3 py-2", r.isMe ? "bg-canal-yellow/15 border border-canal-yellow/40" : "bg-white/5")}>
                <span className="text-base w-6 text-center">{MEDALS[r.rank - 1] ?? r.rank}</span>
                <span className="flex-1 font-bold text-white text-sm truncate">{r.name}{r.isMe && <span className="text-canal-yellow text-xs"> · toi</span>}</span>
                <span className="font-black text-canal-yellow tabular-nums text-sm">{r.points} pts</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Championnat Quiz — classement INDIVIDUEL (qualifie pour la finale). Distinct
          du classement général/équipe : les points de quiz aident AUSSI l'équipe,
          mais ce classement-ci ne compare que les individus pour la finale. */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Trophy size={16} className="text-canal-yellow" />
          <h2 className="font-black text-white">Championnat Quiz</h2>
          <span className="text-[10px] font-black text-white/50 bg-white/10 px-1.5 py-0.5 rounded-full uppercase">Classement individuel</span>
          {board?.qualifClosed && (
            <span className="text-[10px] font-black text-canal-yellow bg-canal-yellow/10 px-1.5 py-0.5 rounded-full uppercase">Qualifs closes</span>
          )}
        </div>
        <p className="text-canal-gray-muted text-xs -mt-1">
          Les <b className="text-white">{finalists} premiers</b> seront qualifiés pour la Grande Finale Quiz.
        </p>

        {/* Accès direct à SON propre détail (transparence : vérifier son score). */}
        {(() => {
          const me = board?.ranking.find((r) => r.isMe);
          return me ? (
            <button
              type="button"
              onClick={() => setDetail({ id: me.user_id, name: me.name })}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-canal-yellow/10 border border-canal-yellow/30 text-canal-yellow font-black text-sm hover:bg-canal-yellow/15 transition-colors"
            >
              📋 Mes résultats — le détail de mon score
            </button>
          ) : null;
        })()}

        {/* Revoir le quiz (public, après la fin) : questions + répartition + titres. */}
        {board && board.finishedSessions > 0 && (
          <button
            type="button"
            onClick={() => setReview(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-canal-gray-light text-white font-bold text-sm hover:bg-white/10 transition-colors"
          >
            🔁 Revoir le dernier quiz (questions & réponses)
          </button>
        )}

        {!board ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" /></div>
        ) : board.ranking.length === 0 ? (
          <p className="text-canal-gray-muted text-sm italic px-1 py-6 text-center">
            Personne n&apos;a encore marqué. Joue au prochain quiz pour ouvrir le classement !
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {board.ranking.slice(0, 30).map((r) => {
              return (
                <button
                  key={r.user_id}
                  type="button"
                  onClick={() => setDetail({ id: r.user_id, name: r.name })}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left w-full transition-colors hover:bg-white/10 cursor-pointer",
                    r.isMe ? "bg-canal-yellow/15 border border-canal-yellow/40" : r.qualified ? "bg-canal-yellow/5 border border-canal-yellow/20" : "bg-white/5"
                  )}
                >
                  <span className={cn("font-black tabular-nums w-7 text-center", r.rank === 1 ? "text-canal-yellow" : r.rank <= 3 ? "text-white" : "text-white/40")}>{r.rank}</span>
                  <span className="flex-1 font-bold text-white text-sm truncate">
                    {r.rank <= 3 ? `${["🥇", "🥈", "🥉"][r.rank - 1]} ` : ""}{r.name}
                    {r.isMe && <span className="text-canal-yellow text-xs"> · toi</span>}
                  </span>
                  {r.qualified && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-canal-yellow bg-canal-yellow/10 border border-canal-yellow/30 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                      <Medal size={11} /> {board.qualifClosed ? "Finaliste" : "Qualifié"}
                    </span>
                  )}
                  <span className="text-white/40 text-xs tabular-nums hidden sm:inline">{r.correct}✓</span>
                  <span className="font-black text-canal-yellow tabular-nums text-sm w-14 text-right">{r.points} pts</span>
                </button>
              );
            })}
          </div>
        )}

        {detail && (
          <QuizPlayerDetail userId={detail.id} userName={detail.name} onClose={() => setDetail(null)} />
        )}
        {review && <QuizReview onClose={() => setReview(false)} />}

        <div className="rounded-xl bg-white/5 border border-canal-gray-light p-3 space-y-1.5">
          <p className="text-canal-gray-muted text-[11px] leading-relaxed flex items-start gap-1.5">
            <Sparkles size={13} className="text-canal-yellow shrink-0 mt-0.5" />
            <span><b className="text-white">Deux objectifs, sans conflit :</b> tes points de quiz comptent <b className="text-white">aussi</b> pour ton équipe au classement général CanalCup. Et ce <b className="text-white">classement individuel</b> sert à entrer dans le Top {finalists} pour la finale.</span>
          </p>
          <p className="text-canal-gray-muted text-[11px] leading-relaxed flex items-start gap-1.5">
            <Trophy size={13} className="text-canal-yellow shrink-0 mt-0.5" />
            <span>Live = 100 % des points · Solo = points réduits.</span>
          </p>
          <p className="text-canal-gray-muted text-[11px] leading-relaxed flex items-start gap-1.5">
            <Sparkles size={13} className="text-canal-yellow shrink-0 mt-0.5" />
            <span><b className="text-white">Clique sur un joueur</b> pour voir le détail : le tien question par question (réponse, bon/faux, temps, points), et le résumé public des autres.</span>
          </p>
        </div>
      </section>
    </div>
  );
}
