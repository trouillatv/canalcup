"use client";

// 🔁 « Revoir le quiz » — revivre une session terminée SANS exposer les réponses
// individuelles : par question, la bonne réponse, l'explication et la répartition
// des votes (A/B/C/D) + taux de réussite. Plus les titres automatiques de fin.

import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";

interface Title { key: string; emoji: string; label: string; winner: string; detail: string }
interface RQuestion {
  index: number;
  question_text: string;
  answer_a: string; answer_b: string; answer_c: string; answer_d: string;
  correct_answer: string;
  explanation: string;
  distribution: { A: number; B: number; C: number; D: number };
  responders: number;
  correct_pct: number;
}
interface Payload {
  available: boolean;
  reason?: string;
  session: { id: string; title: string } | null;
  questions: RQuestion[];
  titles: Title[];
}

export function QuizReview({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/quiz/review", { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) setErr(d?.error ?? `Erreur (HTTP ${r.status})`);
        else setData(d as Payload);
      })
      .catch(() => alive && setErr("Réseau indisponible."));
    return () => { alive = false; };
  }, []);

  const q = data?.questions ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-canal-black border border-canal-yellow/30 rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-canal-black/95 backdrop-blur border-b border-canal-gray-light px-4 py-3 flex items-center justify-between z-10">
          <div className="min-w-0">
            <p className="font-black text-white truncate">🔁 Revoir le quiz</p>
            <p className="text-[11px] text-canal-gray-muted">{data?.session?.title ?? "Dernier quiz"} — questions & réponses</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-canal-gray-muted hover:text-white shrink-0"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          {err && <p className="text-sm text-center text-red-300 bg-red-950/30 border border-red-900/40 rounded-lg py-3 px-3">{err}</p>}
          {!err && !data && (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" /></div>
          )}

          {data && !data.available && (
            <p className="text-sm text-canal-gray-muted italic text-center py-6">
              {data.reason === "not_finished"
                ? "Le quiz est en cours — tu pourras le revoir une fois terminé."
                : "Aucun quiz terminé à revoir pour l'instant."}
            </p>
          )}

          {data?.available && (
            <>
              {/* Titres automatiques */}
              {data.titles.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-black text-canal-yellow uppercase tracking-wide">🏆 Les distinctions</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {data.titles.map((t) => (
                      <div key={t.key} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                        <span className="text-lg shrink-0">{t.emoji}</span>
                        <span className="font-black text-white text-sm shrink-0">{t.label}</span>
                        <span className="text-canal-yellow font-bold text-sm truncate">{t.winner}</span>
                        <span className="text-canal-gray-muted text-[11px] ml-auto shrink-0">{t.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions : répartition + bonne réponse + explication */}
              <div className="space-y-2.5">
                {q.map((question) => (
                  <div key={question.index} className="rounded-xl bg-white/5 border border-canal-gray-light px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] font-black text-white/40 tabular-nums mt-0.5 w-8 shrink-0">Q{question.index}</span>
                      <p className="text-sm text-white leading-snug flex-1 min-w-0">{question.question_text}</p>
                      <span className="text-[11px] font-black text-green-400 shrink-0">{question.correct_pct}%</span>
                    </div>

                    <div className="mt-2 pl-10 space-y-1">
                      {(["A", "B", "C", "D"] as const).map((letter) => {
                        const text = (question[`answer_${letter.toLowerCase()}` as "answer_a" | "answer_b" | "answer_c" | "answer_d"]) || "";
                        const count = question.distribution[letter];
                        const isRight = question.correct_answer === letter;
                        const pct = question.responders ? Math.round((count / question.responders) * 100) : 0;
                        return (
                          <div key={letter} className="relative rounded-lg overflow-hidden">
                            <div className={`absolute inset-y-0 left-0 ${isRight ? "bg-green-600/25" : "bg-white/10"}`} style={{ width: `${pct}%` }} />
                            <div className="relative flex items-center gap-2 px-2 py-1 text-[12px]">
                              <span className={`w-5 h-5 rounded font-black text-[10px] flex items-center justify-center shrink-0 ${isRight ? "bg-green-600 text-white" : "bg-canal-gray-light text-canal-gray-muted"}`}>{letter}</span>
                              <span className={`flex-1 min-w-0 ${isRight ? "text-green-200" : "text-canal-gray-muted"}`}>{text}</span>
                              {isRight && <Check size={12} className="text-green-400 shrink-0" />}
                              <span className="text-white/50 tabular-nums shrink-0">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                      {question.explanation && (
                        <p className="text-[11px] text-canal-gray-muted/90 italic pt-1">💡 {question.explanation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-canal-gray-muted/80 text-center italic">
                Répartition anonyme des votes — les réponses individuelles ne sont jamais affichées.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
