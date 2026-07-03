"use client";

// 🔍 Panneau « détail joueur » du Championnat Quiz — rend chaque point explicable
// (anti-contestation). S'ouvre en cliquant un joueur du classement.
//   - Résumé : bonnes/mauvaises/non répondues, +5 / +3 / +2, temps moyen,
//     points RÉELS (championnat) + points comptés au GÉNÉRAL (pondérés par rang).
//   - Détail question par question : réponse, bonne réponse, juste/faux/non
//     répondu, temps, points, Live/Solo.
// Accès (API) : chaque joueur voit le sien ; l'admin voit tout le monde.

import { useEffect, useState } from "react";
import { X, Check, Minus, Lock, Medal, Flame, Zap } from "lucide-react";

interface Summary {
  display_name: string;
  team_name: string;
  questions_total: number;
  questions_answered: number;
  correct_count: number;
  wrong_count: number;
  no_answer_count: number;
  fast_correct_count: number;
  normal_correct_count: number;
  solo_correct_count: number;
  avg_response_time_ms: number | null;
  fastest_ms: number | null;
  best_streak: number;
  sessions: { title: string; played: boolean }[];
  championship_quiz_points: number;
  quiz_rank: number | null;
  participants_count: number;
  global_quiz_points: number;
}
interface QRow {
  quiz_title: string;
  mode: string;
  question_index: number;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: string;
  explanation: string;
  user_answer: string;
  is_correct: boolean;
  answered: boolean;
  response_time_ms: number | null;
  points_type: string;
  championship_points: number;
  was_speed_bonus: boolean;
  was_solo: boolean;
}
interface Payload {
  player: { user_id: string; display_name: string; team_name: string } | null;
  summary: Summary | null;
  questions: QRow[];
  qualified?: boolean;
  horsConcours?: boolean;
  finalists?: number;
  qualifClosed?: boolean;
  canSeeDetail?: boolean;
  restrictedReason?: "other_player" | "quiz_live" | null;
  error?: string;
}

type Filter = "all" | "correct" | "wrong" | "no_answer" | "fast" | "normal";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "correct", label: "Bonnes" },
  { id: "wrong", label: "Mauvaises" },
  { id: "no_answer", label: "Non répondues" },
  { id: "fast", label: "+5 rapidité" },
  { id: "normal", label: "+3 normales" },
];
function matchFilter(q: QRow, f: Filter): boolean {
  switch (f) {
    case "correct": return q.is_correct;
    case "wrong": return q.points_type === "wrong";
    case "no_answer": return q.points_type === "no_answer";
    case "fast": return q.points_type === "live_fast";
    case "normal": return q.points_type === "live_normal";
    default: return true;
  }
}

function secs(ms: number | null): string {
  return ms == null ? "—" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

export function QuizPlayerDetail({
  userId,
  userName,
  onClose,
}: {
  userId: string;
  userName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/quiz/player-detail?user_id=${encodeURIComponent(userId)}`, { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) setErr(d?.error ?? `Erreur (HTTP ${r.status})`);
        else setData(d as Payload);
      })
      .catch(() => alive && setErr("Réseau indisponible."));
    return () => {
      alive = false;
    };
  }, [userId]);

  const s = data?.summary;
  const canSeeDetail = !!data?.canSeeDetail;
  const rows = (data?.questions ?? []).filter((q) => matchFilter(q, filter));

  // Regroupe l'affichage par quiz (Quiz #1, #2…).
  let lastTitle = "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-canal-black border border-canal-yellow/30 rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-canal-black/95 backdrop-blur border-b border-canal-gray-light px-4 py-3 flex items-center justify-between z-10">
          <div className="min-w-0">
            <p className="font-black text-white truncate">{data?.player?.display_name ?? userName}</p>
            <p className="text-[11px] text-canal-gray-muted">Championnat Quiz — détail</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-canal-gray-muted hover:text-white shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {err && (
            <p className="text-sm text-center text-red-300 bg-red-950/30 border border-red-900/40 rounded-lg py-3 px-3">
              {err}
            </p>
          )}

          {!err && !data && (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {s && (
            <>
              {/* Profil : position championnat + qualification */}
              <div className="flex items-center justify-between gap-2 bg-white/5 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-[10px] text-canal-gray-muted uppercase tracking-wide">Position championnat</p>
                  <p className="font-black text-white text-xl leading-none mt-0.5">
                    {s.quiz_rank ? `${s.quiz_rank}${s.quiz_rank === 1 ? "er" : "e"}` : "—"}
                    <span className="text-canal-gray-muted text-xs font-normal"> / {s.participants_count}</span>
                  </p>
                </div>
                {data?.qualified && (
                  <span className="flex items-center gap-1 text-[11px] font-black text-canal-yellow bg-canal-yellow/10 border border-canal-yellow/30 px-2.5 py-1 rounded-full uppercase">
                    <Medal size={12} /> {data?.qualifClosed ? "Finaliste" : "Qualifié"}
                  </span>
                )}
                {data?.horsConcours && (
                  <span className="text-[11px] font-black text-white/50 bg-white/10 border border-white/15 px-2.5 py-1 rounded-full uppercase">
                    Hors concours
                  </span>
                )}
              </div>

              {/* Participation par quiz */}
              {s.sessions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-canal-gray-muted">Participation :</span>
                  {s.sessions.map((q) => (
                    <span
                      key={q.title}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        q.played
                          ? "bg-green-500/10 border-green-500/30 text-green-300"
                          : "bg-white/5 border-canal-gray-light text-canal-gray-muted"
                      }`}
                    >
                      {q.title} {q.played ? "✅" : "❌"}
                    </span>
                  ))}
                </div>
              )}

              {/* Résumé */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Bonnes", value: s.correct_count, cls: "text-green-400" },
                  { label: "Mauvaises", value: s.wrong_count, cls: "text-red-400" },
                  { label: "Non répondues", value: s.no_answer_count, cls: "text-white/60" },
                ].map((b) => (
                  <div key={b.label} className="bg-white/5 rounded-xl px-2 py-2.5 text-center">
                    <p className={`font-black text-2xl tabular-nums ${b.cls}`}>{b.value}</p>
                    <p className="text-[10px] text-canal-gray-muted mt-0.5">{b.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs bg-white/5 rounded-xl px-3 py-2.5">
                <span className="text-canal-gray-muted">⚡ +5 rapidité : <b className="text-white">{s.fast_correct_count}</b></span>
                <span className="text-canal-gray-muted">🧠 +3 normales : <b className="text-white">{s.normal_correct_count}</b></span>
                {s.solo_correct_count > 0 && (
                  <span className="text-canal-gray-muted">🕒 +2 solo : <b className="text-white">{s.solo_correct_count}</b></span>
                )}
                <span className="text-canal-gray-muted">⏱ Temps moyen : <b className="text-white">{secs(s.avg_response_time_ms)}</b></span>
                <span className="text-canal-gray-muted flex items-center gap-1"><Flame size={11} className="text-orange-400" /> Meilleure série : <b className="text-white">{s.best_streak}</b></span>
                <span className="text-canal-gray-muted flex items-center gap-1"><Zap size={11} className="text-canal-yellow" /> Plus rapide : <b className="text-white">{secs(s.fastest_ms)}</b></span>
              </div>

              {/* Points réels vs comptés au général */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-canal-yellow/10 border border-canal-yellow/30 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-canal-gray-muted uppercase tracking-wide">Points Quiz réels</p>
                  <p className="font-black text-canal-yellow text-2xl tabular-nums">{s.championship_quiz_points}</p>
                  <p className="text-[10px] text-canal-gray-muted">championnat</p>
                </div>
                <div className="bg-white/5 border border-canal-gray-light rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-canal-gray-muted uppercase tracking-wide">Comptés au général</p>
                  <p className="font-black text-white text-2xl tabular-nums">{s.global_quiz_points}</p>
                  <p className="text-[10px] text-canal-gray-muted">
                    {s.quiz_rank ? `rang ${s.quiz_rank}/${s.participants_count} · pondéré` : "non-participant"}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-canal-gray-muted leading-relaxed px-0.5">
                Le championnat garde les <b className="text-white">points réels</b>. Au classement général,
                la contribution quiz est <b className="text-white">normalisée entre 5 et 50 selon le score</b>
                {" "}(meilleur = 50, plus faible participant = 5) pour ne pas écraser les autres épreuves.
              </p>

              {/* Détail réservé (autre joueur / quiz en cours) → note */}
              {!canSeeDetail && (
                <div className="rounded-xl bg-white/5 border border-canal-gray-light px-3 py-3 text-[12px] text-canal-gray-muted leading-relaxed flex items-start gap-2">
                  <Lock size={14} className="text-canal-yellow shrink-0 mt-0.5" />
                  <span>
                    {data?.restrictedReason === "quiz_live"
                      ? "Le détail question par question sera visible à la fin du quiz."
                      : "Détail question par question réservé à ce joueur et à l'organisateur. Voici le résumé public."}
                  </span>
                </div>
              )}

              {/* Filtres (détail autorisé uniquement) */}
              {canSeeDetail && (
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                        filter === f.id ? "bg-canal-yellow text-canal-black" : "bg-white/10 text-canal-gray-muted hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Détail question par question */}
              {canSeeDetail && (
              <div className="space-y-1.5">
                {rows.length === 0 && (
                  <p className="text-sm text-canal-gray-muted italic text-center py-4">
                    Aucune question pour ce filtre.
                  </p>
                )}
                {rows.map((q, i) => {
                  const showHeader = q.quiz_title !== lastTitle;
                  lastTitle = q.quiz_title;
                  const state = q.answered ? (q.is_correct ? "ok" : "ko") : "none";
                  return (
                    <div key={i}>
                      {showHeader && (
                        <p className="text-[11px] font-black text-canal-yellow uppercase tracking-wide mt-3 mb-1">
                          {q.quiz_title}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenIdx(openIdx === i ? null : i)}
                        className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${
                          state === "ok"
                            ? "bg-green-950/20 border-green-900/40 hover:bg-green-950/30"
                            : state === "ko"
                              ? "bg-red-950/20 border-red-900/40 hover:bg-red-950/30"
                              : "bg-white/5 border-canal-gray-light hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-[11px] font-black text-white/40 tabular-nums mt-0.5 w-8 shrink-0">
                            Q{q.question_index}
                          </span>
                          <p className="text-sm text-white leading-snug flex-1 min-w-0">{q.question_text}</p>
                          <span className={`font-black tabular-nums text-sm shrink-0 ${q.championship_points > 0 ? "text-canal-yellow" : "text-white/40"}`}>
                            {q.championship_points > 0 ? `+${q.championship_points}` : "0"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 pl-10 text-[11px]">
                          <span className="text-canal-gray-muted">
                            Réponse : <b className={state === "ok" ? "text-green-400" : state === "ko" ? "text-red-400" : "text-white/60"}>{q.user_answer || "—"}</b>
                          </span>
                          <span className="text-canal-gray-muted">
                            Bonne : <b className="text-white">{q.correct_answer || "?"}</b>
                          </span>
                          <span className={state === "ok" ? "text-green-400 flex items-center gap-0.5" : state === "ko" ? "text-red-400 flex items-center gap-0.5" : "text-white/50 flex items-center gap-0.5"}>
                            {state === "ok" ? <><Check size={11} /> juste</> : state === "ko" ? <><X size={11} /> faux</> : <><Minus size={11} /> non répondu</>}
                          </span>
                          {q.answered && <span className="text-canal-gray-muted">⏱ {secs(q.response_time_ms)}</span>}
                          <span className="text-white/40 uppercase text-[10px] font-bold">{q.was_solo ? "Solo" : "Live"}</span>
                        </div>

                        {/* Détail déplié : les 4 propositions + explication */}
                        {openIdx === i && (
                          <div className="mt-2.5 pl-10 space-y-1">
                            {(["A", "B", "C", "D"] as const).map((letter) => {
                              const text = (q[`answer_${letter.toLowerCase()}` as "answer_a" | "answer_b" | "answer_c" | "answer_d"]) || "";
                              const isUser = q.user_answer === letter;
                              const isRight = q.correct_answer === letter;
                              return (
                                <div
                                  key={letter}
                                  className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[12px] ${
                                    isRight
                                      ? "bg-green-600/20 text-green-200"
                                      : isUser
                                        ? "bg-red-600/20 text-red-200"
                                        : "text-canal-gray-muted"
                                  }`}
                                >
                                  <span className={`w-5 h-5 rounded font-black text-[10px] flex items-center justify-center shrink-0 ${isRight ? "bg-green-600 text-white" : isUser ? "bg-red-600 text-white" : "bg-canal-gray-light text-canal-gray-muted"}`}>{letter}</span>
                                  <span className="flex-1 min-w-0">{text}</span>
                                  {isUser && <span className="text-[10px] font-bold shrink-0">← ta réponse</span>}
                                  {isRight && <span className="text-[10px] font-bold shrink-0">✓ bonne</span>}
                                </div>
                              );
                            })}
                            {q.explanation && (
                              <p className="text-[11px] text-canal-gray-muted/90 italic pt-1">💡 {q.explanation}</p>
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              )}

              <p className="text-[11px] text-canal-gray-muted/80 text-center italic pt-1">
                Le détail des réponses est visible uniquement par toi et les organisateurs.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
