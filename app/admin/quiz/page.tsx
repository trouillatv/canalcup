"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Trash2, Sparkles, Plus, ChevronDown, ChevronUp, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizQuestion, QuizCategory, QuizDifficulty } from "@/lib/supabase/types";

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

  // AI generation state
  const [genCategory, setGenCategory] = useState<QuizCategory>("general");
  const [genDifficulty, setGenDifficulty] = useState<QuizDifficulty>("easy");
  const [genCount, setGenCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);

  // Manual form state
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Expanded question
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/quiz");
    const data: QuizQuestion[] = await res.json();
    setQuestions(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch("/api/admin/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: genCategory, difficulty: genDifficulty, count: genCount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenResult(`Erreur : ${data.error}${data.hint ? ` — ${data.hint}` : ""}`);
      } else {
        setGenResult(`✅ ${data.count} question(s) générée(s) — coût estimé : ${data.costEur}€`);
        fetchQuestions();
      }
    } catch {
      setGenResult("Erreur réseau.");
    } finally {
      setGenerating(false);
    }
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

      {/* ─── Génération IA ─── */}
      <section className="canal-card space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-canal-yellow" />
          <h2 className="font-bold text-white">Générer avec l'IA</h2>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-canal-gray-muted mb-1 block">Catégorie</label>
            <select
              value={genCategory}
              onChange={(e) => setGenCategory(e.target.value as QuizCategory)}
              className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-canal-gray-muted mb-1 block">Difficulté</label>
            <select
              value={genDifficulty}
              onChange={(e) => setGenDifficulty(e.target.value as QuizDifficulty)}
              className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-canal-gray-muted mb-1 block">Nombre</label>
            <input
              type="number"
              min={1}
              max={10}
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
              className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full py-3 bg-canal-yellow text-canal-black font-black rounded-xl hover:bg-canal-yellow-hover transition-colors disabled:opacity-50"
        >
          {generating ? "Génération en cours…" : `Générer ${genCount} question(s) ⚡`}
        </button>

        {genResult && (
          <p className={cn("text-sm", genResult.startsWith("✅") ? "text-green-400" : "text-red-400")}>
            {genResult}
          </p>
        )}
      </section>

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
            Aucune question. Générez-en avec l'IA ou ajoutez-en manuellement.
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
