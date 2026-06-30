"use client";

// 🧠⚡ Hub Quiz CanalCup — le quiz n'est plus une animation ponctuelle, c'est un
// CHAMPIONNAT qui dure toute la CdM :
//  - Quiz Live (officiel, en salle, 100 % des points) → /quiz-live ;
//  - Quiz Solo (à distance, points réduits) → /quiz/solo ;
//  - Classement championnat (cumul) + badge « Qualifié pour la Finale » top N ;
//  - Grande Finale Quiz inscrite au calendrier.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Trophy, Radio, Medal, Crown, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankRow {
  user_id: string; name: string; points: number; correct: number; answered: number;
  rank: number; qualified: boolean; isMe: boolean;
}
interface Board {
  ranking: RankRow[];
  finalists: number;
  qualifClosed: boolean;
  finale: { enabled: boolean; dateLabel: string; timeLabel: string; title: string };
}

export default function QuizHubPage() {
  const [liveActive, setLiveActive] = useState(false);
  const [soloAvailable, setSoloAvailable] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/quiz/session", { credentials: "same-origin" })
        .then((r) => r.json()).then((d) => setLiveActive(d.status === "question")).catch(() => {});
      fetch("/api/quiz/solo", { credentials: "same-origin" })
        .then((r) => r.json()).then((d) => setSoloAvailable(!!d.available)).catch(() => {});
      fetch("/api/quiz/leaderboard", { credentials: "same-origin" })
        .then((r) => r.json()).then((d) => setBoard(d as Board)).catch(() => {});
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const finale = board?.finale;
  const finalists = board?.finalists ?? 5;

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
          <p className="text-canal-gray-muted text-xs leading-relaxed">En salle, écran projeté, animé par l&apos;organisateur. C&apos;est le mode officiel qui crée l&apos;ambiance.</p>
        </Link>

        <Link
          href={soloAvailable ? "/quiz/solo" : "/quiz"}
          className={cn("canal-card transition-colors", soloAvailable ? "hover:border-canal-yellow/50" : "opacity-60 pointer-events-none")}
        >
          <div className="flex items-center gap-2 mb-1">
            <Brain size={16} className="text-canal-yellow" />
            <span className="font-black text-white">Quiz Solo</span>
            <span className="ml-auto text-[10px] font-black text-white/70 bg-white/10 px-1.5 py-0.5 rounded-full uppercase">
              {soloAvailable ? "Ouvert" : "Bientôt"}
            </span>
          </div>
          <p className="text-canal-gray-muted text-xs leading-relaxed">
            À distance, à ton rythme, depuis ton écran. Points réduits — ouvre après le lancement officiel.
          </p>
        </Link>
      </div>

      {/* Grande Finale */}
      {finale?.enabled && (
        <div className="rounded-2xl border border-canal-yellow/30 bg-gradient-to-b from-canal-yellow/10 to-transparent p-4">
          <div className="flex items-center gap-2 mb-1">
            <Crown size={18} className="text-canal-yellow" />
            <span className="font-black text-canal-yellow uppercase tracking-wide text-sm">{finale.title}</span>
          </div>
          <p className="text-white font-bold">{finale.dateLabel} · {finale.timeLabel}</p>
          <p className="text-canal-gray-muted text-xs mt-1 leading-relaxed">
            Les <b>{finalists} meilleurs</b> du classement Quiz sont qualifiés. Finale jouée en direct devant tout le monde — le vainqueur est sacré <b>Champion Quiz CanalCup</b>.
          </p>
        </div>
      )}

      {/* Classement championnat */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-canal-yellow" />
          <h2 className="font-black text-white">Classement Quiz</h2>
          {board?.qualifClosed && (
            <span className="text-[10px] font-black text-canal-yellow bg-canal-yellow/10 px-1.5 py-0.5 rounded-full uppercase">Qualifs closes</span>
          )}
        </div>

        {!board ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" /></div>
        ) : board.ranking.length === 0 ? (
          <p className="text-canal-gray-muted text-sm italic px-1 py-6 text-center">
            Personne n&apos;a encore marqué. Joue au prochain quiz pour ouvrir le classement !
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {board.ranking.slice(0, 30).map((r) => (
              <div
                key={r.user_id}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5",
                  r.isMe ? "bg-canal-yellow/15 border border-canal-yellow/40" : r.qualified ? "bg-canal-yellow/5 border border-canal-yellow/20" : "bg-white/5"
                )}
              >
                <span className={cn("font-black tabular-nums w-7 text-center", r.rank === 1 ? "text-canal-yellow" : r.rank <= 3 ? "text-white" : "text-white/40")}>
                  {r.rank}
                </span>
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
              </div>
            ))}
          </div>
        )}

        <p className="text-canal-gray-muted text-[11px] leading-relaxed px-1 flex items-start gap-1.5">
          <Sparkles size={13} className="text-canal-yellow shrink-0 mt-0.5" />
          Live = 100 % des points · Solo = points réduits. Les {finalists} premiers à la clôture jouent la Grande Finale.
        </p>
      </section>
    </div>
  );
}
