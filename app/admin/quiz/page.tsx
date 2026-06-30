"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  SkipForward,
  Square,
  RotateCcw,
  Radio,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizQuestion, QuizCategory, QuizDifficulty } from "@/lib/supabase/types";

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

interface LiveSessionState {
  status: "idle" | "question";
  paused?: boolean;
  question?: { id: string; question: string };
  question_index?: number;
  total?: number;
  started_at?: string;
}

interface LeaderboardRow {
  user_id: string;
  name: string;
  team_id: string;
  team_name: string;
  total_points: number;
  correct: number;
  answered: number;
}
interface TeamRow {
  team_id: string;
  name: string;
  total_points: number;
  players: number;
  correct: number;
  answered: number;
}
interface ResultsPayload {
  session: {
    id: string;
    status: "question" | "finished";
    started_at: string;
    ended_at: string | null;
    question_index: number;
    total: number;
  } | null;
  questionsAnswered: number;
  leaderboard: LeaderboardRow[];
  teams: TeamRow[];
}

const CATEGORIES: QuizCategory[] = ["foot", "culture", "canal", "general"];
const DIFFICULTIES: QuizDifficulty[] = ["easy", "medium", "hard"];
const CATEGORY_LABELS: Record<QuizCategory, string> = {
  foot: "⚽ Football",
  culture: "🌍 Culture générale",
  canal: "📺 Canal+",
  general: "🎲 Général",
};
const DIFFICULTY_LABELS: Record<QuizDifficulty, string> = {
  easy: "Facile",
  medium: "Moyen",
  hard: "Difficile",
};
const DIFFICULTY_COLORS: Record<QuizDifficulty, string> = {
  easy: "text-green-400",
  medium: "text-yellow-400",
  hard: "text-red-400",
};

interface FormState {
  question: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  difficulty: QuizDifficulty;
  category: QuizCategory;
}

const EMPTY_FORM: FormState = {
  question: "",
  answer_a: "",
  answer_b: "",
  answer_c: "",
  answer_d: "",
  correct_answer: "A",
  difficulty: "easy",
  category: "general",
};

export default function AdminQuizPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual form state
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Expanded question
  const [expanded, setExpanded] = useState<string | null>(null);

  // Live Show control panel
  const [live, setLive] = useState<LiveSessionState>({ status: "idle" });
  const [liveActing, setLiveActing] = useState<null | "start" | "pause" | "resume" | "next" | "end" | "reset">(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Résultats du quiz (live + récap final)
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [resultsTab, setResultsTab] = useState<"players" | "teams">("players");
  const [resultsExpanded, setResultsExpanded] = useState(true);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/quiz");
    const data: QuizQuestion[] = await res.json();
    setQuestions(data);
    setLoading(false);
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/quiz/session", { credentials: "same-origin" });
      if (!res.ok) return;
      const d = await res.json();
      if (d.status === "question" && d.question) {
        setLive({
          status: "question",
          paused: !!d.paused,
          question: { id: d.question.id, question: d.question.question },
          question_index: d.question_index ?? 0,
          total: d.total ?? 0,
          started_at: d.started_at,
        });
      } else {
        setLive({ status: "idle" });
      }
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/quiz/results", {
        credentials: "same-origin",
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!res.ok) return;
      const d: ResultsPayload = await res.json();
      setResults(d);
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    fetchLive();
    fetchResults();
    const t = setInterval(() => {
      fetchLive();
      fetchResults();
    }, 3000);
    return () => clearInterval(t);
  }, [fetchLive, fetchResults]);

  const callLive = useCallback(
    async (action: "start" | "pause" | "resume" | "next" | "end" | "reset") => {
      setLiveActing(action);
      setLiveError(null);
      try {
        const res = await fetch("/api/admin/quiz/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": ADMIN_SECRET,
          },
          body: JSON.stringify({ action }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLiveError(d?.error || `Erreur (HTTP ${res.status})`);
        }
      } catch (e) {
        setLiveError(e instanceof Error ? e.message : "Erreur réseau");
      }
      setLiveActing(null);
      fetchLive();
    },
    [fetchLive]
  );

  const onStart = () => {
    if (!confirm("Lancer le quiz live ? Tous les joueurs verront la 1ère question.")) return;
    callLive("start");
  };
  const onNext = () => callLive("next");
  const onPause = () => callLive("pause");
  const onResume = () => callLive("resume");
  const onEnd = () => {
    if (!confirm("Terminer le quiz live ?")) return;
    callLive("end");
  };
  const onReset = () => {
    if (
      !confirm(
        "⚠️ Reset : termine la session ET supprime TOUTES les réponses quiz déjà enregistrées (impacte le classement). Continuer ?"
      )
    )
      return;
    callLive("reset");
  };

  const handleManualSave = async () => {
    if (!form.question || !form.answer_a || !form.answer_b || !form.answer_c || !form.answer_d) return;
    setSaving(true);
    const res = await fetch("/api/admin/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm(EMPTY_FORM);
      setShowManual(false);
      fetchQuestions();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/quiz?id=${id}`, { method: "DELETE" });
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="canal-headline text-2xl">Admin — Questions Quiz</h1>
          <p className="text-canal-gray-muted text-sm mt-1">
            {questions.length} question(s) en base
          </p>
        </div>
        <Link
          href="/quiz-show"
          target="_blank"
          className="flex items-center gap-2 px-4 py-2 bg-canal-yellow text-canal-black font-black text-sm rounded-xl hover:bg-canal-yellow-hover transition-colors shrink-0"
        >
          <Play size={14} /> Diaporama
        </Link>
      </div>

      {/* ─── Live Show — pilotage ─── */}
      <section className="canal-card space-y-4 border border-canal-yellow/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio
              size={16}
              className={cn(
                live.status === "question" ? "text-red-400 animate-pulse" : "text-canal-gray-muted"
              )}
            />
            <h2 className="font-bold text-white">Quiz Live</h2>
          </div>
          <span
            className={cn(
              "text-xs font-black px-2 py-0.5 rounded-full",
              live.status === "question"
                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                : "bg-canal-gray-mid text-canal-gray-muted border border-canal-gray-light"
            )}
          >
            {live.status === "question" ? "● LIVE" : "Arrêté"}
          </span>
        </div>

        {live.status === "question" && live.question && (
          <div className="bg-canal-gray-mid border border-canal-gray-light rounded-lg p-3 space-y-1">
            <p className="text-xs text-canal-gray-muted">
              Question{" "}
              <span className="text-white font-bold">
                {(live.question_index ?? 0) + 1}
              </span>
              {live.total ? ` / ${live.total}` : ""} — en cours
            </p>
            <p className="text-sm font-bold text-white leading-snug">
              {live.question.question}
            </p>
          </div>
        )}

        {liveError && (
          <p className="text-xs text-red-400 bg-red-950/30 border border-red-500/40 rounded-lg px-3 py-2">
            {liveError}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {live.status === "idle" ? (
            <button
              onClick={onStart}
              disabled={liveActing !== null || questions.length === 0}
              className="col-span-2 flex items-center justify-center gap-2 py-3 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-40"
            >
              <Play size={14} />
              {liveActing === "start" ? "Lancement…" : "Lancer le quiz"}
            </button>
          ) : (
            <>
              {live.paused ? (
                <button
                  onClick={onResume}
                  disabled={liveActing !== null}
                  className="col-span-2 flex items-center justify-center gap-2 py-3 bg-green-500 text-black font-black rounded-xl hover:bg-green-400 transition-colors disabled:opacity-40"
                >
                  <Play size={14} />
                  {liveActing === "resume" ? "…" : "Reprendre"}
                </button>
              ) : (
                <button
                  onClick={onPause}
                  disabled={liveActing !== null}
                  className="col-span-2 flex items-center justify-center gap-2 py-3 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-40"
                >
                  <Pause size={14} />
                  {liveActing === "pause" ? "…" : "Pause"}
                </button>
              )}
              <button
                onClick={onNext}
                disabled={liveActing !== null}
                className="flex items-center justify-center gap-2 py-3 bg-canal-gray-mid text-white font-black rounded-xl border border-canal-gray-light hover:bg-canal-gray-light transition-colors disabled:opacity-40"
              >
                <SkipForward size={14} />
                {liveActing === "next" ? "…" : "Sauter"}
              </button>
              <button
                onClick={onEnd}
                disabled={liveActing !== null}
                className="flex items-center justify-center gap-2 py-3 bg-canal-gray-mid text-white font-black rounded-xl border border-canal-gray-light hover:bg-canal-gray-light transition-colors disabled:opacity-40"
              >
                <Square size={14} />
                {liveActing === "end" ? "…" : "Terminer"}
              </button>
            </>
          )}
          <button
            onClick={onReset}
            disabled={liveActing !== null}
            className="col-span-2 flex items-center justify-center gap-2 py-2.5 bg-red-950/40 text-red-400 font-bold text-sm rounded-xl border border-red-500/40 hover:bg-red-950/60 transition-colors disabled:opacity-40"
          >
            <RotateCcw size={13} />
            {liveActing === "reset"
              ? "Reset en cours…"
              : "Reset (efface toutes les réponses & points quiz)"}
          </button>
        </div>

        <p className="text-xs text-canal-gray-muted leading-relaxed">
          Les joueurs voient les questions sur{" "}
          <code className="text-canal-yellow">/quiz-live</code>. Le quiz s&apos;enchaîne
          tout seul (20s par question, puis la bonne réponse, puis question suivante).
          La seule commande de rythme est <b>Pause / Reprendre</b>. +5 pts si bonne
          réponse en &lt;5s, +3 sinon, 0 si faux ou timeout.
        </p>
      </section>

      {/* ─── Résultats (live + récap final) ─── */}
      {results && results.session && (results.leaderboard.length > 0 || results.session.status === "finished") && (
        <section className="canal-card space-y-3">
          <button
            onClick={() => setResultsExpanded((v) => !v)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-canal-yellow" />
              <h2 className="font-bold text-white">
                Résultats
                {results.session.status === "finished" && (
                  <span className="text-canal-gray-muted font-normal text-xs ml-2">
                    — quiz terminé
                  </span>
                )}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-canal-gray-muted">
                {results.leaderboard.length} joueur(s) · {results.questionsAnswered} q.
              </span>
              {resultsExpanded ? (
                <ChevronUp size={16} className="text-canal-gray-muted" />
              ) : (
                <ChevronDown size={16} className="text-canal-gray-muted" />
              )}
            </div>
          </button>

          {resultsExpanded && (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setResultsTab("players")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                    resultsTab === "players"
                      ? "bg-canal-yellow text-canal-black"
                      : "bg-canal-gray-mid text-canal-gray-muted border border-canal-gray-light"
                  )}
                >
                  <Trophy size={12} /> Joueurs
                </button>
                <button
                  onClick={() => setResultsTab("teams")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                    resultsTab === "teams"
                      ? "bg-canal-yellow text-canal-black"
                      : "bg-canal-gray-mid text-canal-gray-muted border border-canal-gray-light"
                  )}
                >
                  <Users size={12} /> Équipes
                </button>
              </div>

              {resultsTab === "players" && (
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {results.leaderboard.length === 0 ? (
                    <p className="text-canal-gray-muted text-xs italic">
                      Pas encore de réponses.
                    </p>
                  ) : (
                    results.leaderboard.map((row, i) => (
                      <div
                        key={row.user_id}
                        className="flex items-center gap-3 px-3 py-2 bg-canal-gray-mid rounded-lg border border-canal-gray-light"
                      >
                        <span
                          className={cn(
                            "w-7 text-center font-black text-sm shrink-0",
                            i === 0
                              ? "text-canal-yellow"
                              : i === 1
                              ? "text-canal-gray-light"
                              : i === 2
                              ? "text-orange-400"
                              : "text-canal-gray-muted"
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {row.name}
                          </p>
                          <p className="text-xs text-canal-gray-muted truncate">
                            {row.team_name} · {row.correct}/{row.answered} ✓
                          </p>
                        </div>
                        <span className="font-black text-canal-yellow text-base tabular-nums shrink-0">
                          {row.total_points} pt{row.total_points > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {resultsTab === "teams" && (
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {results.teams.length === 0 ? (
                    <p className="text-canal-gray-muted text-xs italic">
                      Pas encore de réponses.
                    </p>
                  ) : (
                    results.teams.map((row, i) => (
                      <div
                        key={row.team_id}
                        className="flex items-center gap-3 px-3 py-2 bg-canal-gray-mid rounded-lg border border-canal-gray-light"
                      >
                        <span
                          className={cn(
                            "w-7 text-center font-black text-sm shrink-0",
                            i === 0
                              ? "text-canal-yellow"
                              : i === 1
                              ? "text-canal-gray-light"
                              : i === 2
                              ? "text-orange-400"
                              : "text-canal-gray-muted"
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {row.name}
                          </p>
                          <p className="text-xs text-canal-gray-muted truncate">
                            {row.players} joueur(s) · {row.correct}/{row.answered} ✓
                          </p>
                        </div>
                        <span className="font-black text-canal-yellow text-base tabular-nums shrink-0">
                          {row.total_points} pt{row.total_points > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ─── Ajout manuel ─── */}
      <section className="canal-card space-y-4">
        <button
          onClick={() => setShowManual((v) => !v)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-canal-yellow" />
            <h2 className="font-bold text-white">Ajouter manuellement</h2>
          </div>
          {showManual ? <ChevronUp size={16} className="text-canal-gray-muted" /> : <ChevronDown size={16} className="text-canal-gray-muted" />}
        </button>

        {showManual && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-canal-gray-muted mb-1 block">Catégorie</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as QuizCategory }))}
                  className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-canal-gray-muted mb-1 block">Difficulté</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as QuizDifficulty }))}
                  className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
                >
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-canal-gray-muted mb-1 block">Question</label>
              <textarea
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                placeholder="Quel pays a remporté la Coupe du Monde 2018 ?"
                rows={2}
                className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white placeholder:text-canal-gray-muted resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(["A", "B", "C", "D"] as const).map((key) => {
                const field = `answer_${key.toLowerCase()}` as keyof typeof form;
                return (
                  <div key={key}>
                    <label className="text-xs text-canal-gray-muted mb-1 flex items-center gap-1">
                      <span className="w-5 h-5 bg-canal-gray-light rounded text-xs font-black flex items-center justify-center text-white">{key}</span>
                      {form.correct_answer === key && <span className="text-canal-yellow text-xs">✓ bonne réponse</span>}
                    </label>
                    <input
                      value={form[field] as string}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      placeholder={`Réponse ${key}`}
                      className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white placeholder:text-canal-gray-muted"
                    />
                  </div>
                );
              })}
            </div>

            <div>
              <label className="text-xs text-canal-gray-muted mb-1 block">Bonne réponse</label>
              <div className="flex gap-2">
                {(["A", "B", "C", "D"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setForm((f) => ({ ...f, correct_answer: key }))}
                    className={cn(
                      "flex-1 py-2 rounded-lg font-black text-sm transition-all",
                      form.correct_answer === key
                        ? "bg-canal-yellow text-canal-black"
                        : "bg-canal-gray-mid text-canal-gray-muted border border-canal-gray-light"
                    )}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleManualSave}
              disabled={saving || !form.question || !form.answer_a || !form.answer_b || !form.answer_c || !form.answer_d}
              className="w-full py-3 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-40"
            >
              {saving ? "Enregistrement…" : "Enregistrer la question"}
            </button>
          </div>
        )}
      </section>

      {/* ─── Liste des questions ─── */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">
          Questions existantes
        </h2>

        {loading && (
          <div className="canal-card text-center py-6 text-canal-gray-muted">Chargement…</div>
        )}

        {!loading && questions.length === 0 && (
          <div className="canal-card text-center py-6 text-canal-gray-muted">
            Aucune question. Ajoutez-en manuellement.
          </div>
        )}

        {questions.map((q) => (
          <div key={q.id} className="canal-card">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-canal-gray-muted">{CATEGORY_LABELS[q.category]}</span>
                  <span className={cn("text-xs font-bold", DIFFICULTY_COLORS[q.difficulty])}>
                    {DIFFICULTY_LABELS[q.difficulty]}
                  </span>
                </div>
                <p className="text-sm font-bold text-white leading-snug">{q.question}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                  className="p-1.5 text-canal-gray-muted hover:text-white transition-colors"
                >
                  {expanded === q.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="p-1.5 text-canal-gray-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {expanded === q.id && (
              <div className="mt-3 pt-3 border-t border-canal-gray-light grid grid-cols-2 gap-2">
                {(["A", "B", "C", "D"] as const).map((key) => {
                  const text = q[`answer_${key.toLowerCase()}` as keyof QuizQuestion] as string;
                  const isCorrect = q.correct_answer === key;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs",
                        isCorrect ? "bg-green-950/40 text-green-400" : "text-canal-gray-muted"
                      )}
                    >
                      <span className={cn(
                        "w-5 h-5 rounded font-black flex items-center justify-center flex-shrink-0",
                        isCorrect ? "bg-green-600 text-white" : "bg-canal-gray-light text-canal-gray-muted"
                      )}>{key}</span>
                      {text}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        ))}
      </section>
    </div>
  );
}
