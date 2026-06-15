"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Trophy, Star, Zap, ArrowLeft, Target, Clock, Lock, Pencil } from "lucide-react";

import { scoreLabel } from "@/lib/scoring";
import { teamFlag } from "@/lib/utils";
import { LocalTime } from "@/components/timezone/LocalTime";
import { WC_ATTACKERS_2026 as TOP_SCORERS } from "@/lib/football/wc-attackers-2026";
import { WC_START_MS } from "@/lib/tournament";

// 48 équipes qualifiées — tirage officiel du 5 décembre 2025 (aligné sur groups-2026.ts)
const WC_TEAMS = [
  "Mexique","Corée du Sud","Afrique du Sud","République Tchèque",
  "Canada","Suisse","Qatar","Bosnie-Herzégovine",
  "Brésil","Maroc","Écosse","Haïti",
  "États-Unis","Australie","Paraguay","Turquie",
  "Allemagne","Équateur","Côte d'Ivoire","Curaçao",
  "Pays-Bas","Japon","Tunisie","Suède",
  "Belgique","Iran","Égypte","Nouvelle-Zélande",
  "Espagne","Uruguay","Arabie Saoudite","Cap-Vert",
  "France","Sénégal","Norvège","Irak",
  "Argentine","Autriche","Algérie","Jordanie",
  "Portugal","Colombie","Ouzbékistan","RD Congo",
  "Angleterre","Croatie","Ghana","Panama",
];

const TEAMS_SORTED = [...WC_TEAMS].sort((a, b) => a.localeCompare(b, "fr"));


interface BonusPredictions {
  winner?: string;
  top_scorer?: string;
  perfect_streak?: number;
}

interface MatchRow {
  id: string;
  team_a: string;
  team_b: string;
  flag_a?: string;
  flag_b?: string;
  score_a?: number;
  score_b?: number;
  status: string;
  starts_at: string;
  phase?: string;
  is_settled?: boolean;
}

interface PredRow {
  id: string;
  match_id: string;
  predicted_score_a: number;
  predicted_score_b: number;
  points_awarded: number;
  match: MatchRow | null;
}

interface HistoryStats {
  total_predictions: number;
  finished_matches: number;
  pending: number;
  total_points: number;
  exact_scores: number;
  correct_results: number;
}

export default function PredictionsPage() {
  const wcStarted = useMemo(() => Date.now() >= WC_START_MS, []);
  const [saved, setSaved] = useState<BonusPredictions>({});
  const [winner, setWinner] = useState("");
  const [topScorer, setTopScorer] = useState("");
  const [topScorerSearch, setTopScorerSearch] = useState("");
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<PredRow[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [tab, setTab] = useState<"historique" | "bonus">("historique");

  useEffect(() => {
    fetch("/api/predictions/bonus")
      .then((r) => r.json())
      .then((d) => {
        if (d.predictions) {
          const w = d.predictions.find((p: { prediction_type: string }) => p.prediction_type === "winner");
          const ts = d.predictions.find((p: { prediction_type: string }) => p.prediction_type === "top_scorer");
          const ps = d.predictions.find((p: { prediction_type: string }) => p.prediction_type === "perfect_streak");
          if (w) { setSaved((s) => ({ ...s, winner: w.predicted_value })); setWinner(w.predicted_value); }
          if (ts) { setSaved((s) => ({ ...s, top_scorer: ts.predicted_value })); setTopScorer(ts.predicted_value); }
          if (ps) setSaved((s) => ({ ...s, perfect_streak: ps.points_awarded }));
        }
      })
      .catch(() => {});

    fetch("/api/predictions/history")
      .then((r) => r.json())
      .then((d) => {
        setHistory(d.history ?? []);
        setStats(d.stats ?? null);
      })
      .catch(() => {});
  }, []);

  const save = async (type: "winner" | "top_scorer", value: string) => {
    if (!value) return;
    setSaving(type);
    await fetch("/api/predictions/bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prediction_type: type, predicted_value: value }),
    });
    setSaving(null);
    setDone((d) => ({ ...d, [type]: true }));
    setSaved((s) => ({ ...s, [type]: value }));
    setTimeout(() => setDone((d) => ({ ...d, [type]: false })), 2000);
  };

  const finishedPreds = history.filter((p) => p.match?.status === "finished");
  const livePreds = history.filter((p) => p.match?.status === "live");
  const pendingPreds = history.filter((p) => p.match?.status === "upcoming");

  return (
    <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/matches" className="text-canal-gray-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="canal-headline text-2xl">Mes Pronostics</h1>
          <p className="text-canal-gray-muted text-sm">Historique et bonus spéciaux</p>
        </div>
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="canal-card text-center p-3">
            <p className="font-black text-2xl text-canal-yellow">{stats.total_points}</p>
            <p className="text-xs text-canal-gray-muted mt-0.5">pts pronos</p>
          </div>
          <div className="canal-card text-center p-3">
            <p className="font-black text-2xl text-white">{stats.exact_scores}</p>
            <p className="text-xs text-canal-gray-muted mt-0.5">🎯 exacts</p>
          </div>
          <div className="canal-card text-center p-3">
            <p className="font-black text-2xl text-white">{stats.pending}</p>
            <p className="text-xs text-canal-gray-muted mt-0.5">en attente</p>
          </div>
        </div>
      )}

      {/* Rappel des règles de points */}
      <div className="canal-card flex flex-wrap gap-x-4 gap-y-1 text-xs py-2.5">
        <span className="text-canal-gray-muted">🎯 Résultat correct (V/N/D) <span className="text-canal-yellow font-bold">+5 pts</span></span>
        <span className="text-canal-gray-muted">🎰 Score exact <span className="text-canal-yellow font-bold">+10 pts</span></span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-canal-gray rounded-xl p-1">
        {(["historique", "bonus"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors capitalize ${
              tab === t ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
            }`}
          >
            {t === "historique" ? "📋 Historique" : "⭐ Bonus"}
          </button>
        ))}
      </div>

      {/* ── HISTORIQUE ── */}
      {tab === "historique" && (
        <div className="space-y-3">
          {finishedPreds.length === 0 && livePreds.length === 0 && pendingPreds.length === 0 && (
            <div className="canal-card text-center py-8">
              <p className="text-canal-gray-muted">Aucun pronostic encore.</p>
              <Link href="/matches" className="text-canal-yellow text-sm font-bold mt-2 block">
                Pronostiquer les matchs →
              </Link>
            </div>
          )}

          {livePreds.length > 0 && (
            <section>
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <span className="live-dot" /> En direct ({livePreds.length})
              </p>
              <div className="space-y-2">
                {livePreds.map((p) => (
                  <PredHistoryRow key={p.id} pred={p} />
                ))}
              </div>
            </section>
          )}

          {pendingPreds.length > 0 && (
            <section>
              <p className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock size={11} /> En attente ({pendingPreds.length})
              </p>
              <div className="space-y-2">
                {pendingPreds.map((p) => (
                  <PredHistoryRow key={p.id} pred={p} />
                ))}
              </div>
            </section>
          )}

          {finishedPreds.length > 0 && (
            <section>
              <p className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider mb-2">
                Terminés ({finishedPreds.length})
              </p>
              <div className="space-y-2">
                {finishedPreds.map((p) => (
                  <PredHistoryRow key={p.id} pred={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── BONUS ── */}
      {tab === "bonus" && (
        <div className="space-y-4">
          {/* Vainqueur */}
          <div className="canal-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-canal-yellow/10 rounded-xl flex items-center justify-center">
                <Trophy size={20} className="text-canal-yellow" />
              </div>
              <div>
                <p className="font-black text-white">Vainqueur de la Coupe du Monde</p>
                <p className="text-xs text-canal-gray-muted">+20 pts si votre équipe soulève le trophée</p>
              </div>
            </div>

            {saved.winner && !editing.winner ? (
              <div className="flex items-center gap-3 bg-canal-gray-mid rounded-xl px-4 py-3">
                <span className="text-xl">🏆</span>
                <span className="font-black text-white flex-1">{saved.winner}</span>
                {!wcStarted && (
                  <button
                    onClick={() => { setWinner(saved.winner!); setEditing((e) => ({ ...e, winner: true })); }}
                    className="p-1.5 text-canal-gray-muted hover:text-canal-yellow transition-colors"
                    title="Modifier"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <span className="text-canal-yellow font-black">+20 pts</span>
              </div>
            ) : wcStarted && !saved.winner ? (
              <div className="flex items-center gap-2 text-canal-gray-muted text-sm py-2">
                <Lock size={14} className="shrink-0" />
                <span>Pronostic fermé — la Coupe du Monde a commencé.</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                  {TEAMS_SORTED.map((team) => (
                    <button
                      key={team}
                      onClick={() => setWinner(team)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-colors text-left truncate ${
                        winner === team
                          ? "bg-canal-yellow text-canal-black"
                          : "bg-canal-gray-mid text-white hover:bg-canal-gray-light"
                      }`}
                    >
                      {team}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {editing.winner && (
                    <button
                      onClick={() => setEditing((e) => ({ ...e, winner: false }))}
                      className="flex-1 py-3 rounded-xl bg-canal-gray-mid text-white font-black"
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={async () => { await save("winner", winner); setEditing((e) => ({ ...e, winner: false })); }}
                    disabled={!winner || saving === "winner"}
                    className="flex-1 py-3 rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-40"
                  >
                    {saving === "winner" ? "Enregistrement…" : done.winner ? "✅ Sauvegardé !" : "Valider mon choix"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Meilleur buteur */}
          <div className="canal-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-canal-yellow/10 rounded-xl flex items-center justify-center">
                <Star size={20} className="text-canal-yellow" />
              </div>
              <div>
                <p className="font-black text-white">Meilleur buteur du tournoi</p>
                <p className="text-xs text-canal-gray-muted">+10 pts si vous devinez le top scorer</p>
              </div>
            </div>

            {saved.top_scorer && !editing.top_scorer ? (
              <div className="flex items-center gap-3 bg-canal-gray-mid rounded-xl px-4 py-3">
                <span className="text-xl">⚽</span>
                <span className="font-black text-white flex-1">{saved.top_scorer}</span>
                {!wcStarted && (
                  <button
                    onClick={() => {
                      setTopScorer(saved.top_scorer!);
                      setTopScorerSearch(saved.top_scorer!);
                      setEditing((e) => ({ ...e, top_scorer: true }));
                    }}
                    className="p-1.5 text-canal-gray-muted hover:text-canal-yellow transition-colors"
                    title="Modifier"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <span className="text-canal-yellow font-black">+10 pts</span>
              </div>
            ) : wcStarted && !saved.top_scorer ? (
              <div className="flex items-center gap-2 text-canal-gray-muted text-sm py-2">
                <Lock size={14} className="shrink-0" />
                <span>Pronostic fermé — la Coupe du Monde a commencé.</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Rechercher un joueur ou un pays…"
                  value={topScorerSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTopScorerSearch(val);
                    if (!val.trim()) { setTopScorer(""); return; }
                    const filtered = TOP_SCORERS.filter(
                      (p) =>
                        p.name.toLowerCase().includes(val.toLowerCase()) ||
                        p.country.toLowerCase().includes(val.toLowerCase())
                    );
                    setTopScorer(filtered.length > 0 ? filtered[0].name : "");
                  }}
                  className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-2.5 text-white placeholder-canal-gray-muted focus:border-canal-yellow outline-none text-sm"
                />
                <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
                  {TOP_SCORERS.filter(
                    (p) =>
                      p.name.toLowerCase().includes(topScorerSearch.toLowerCase()) ||
                      p.country.toLowerCase().includes(topScorerSearch.toLowerCase())
                  ).map((player) => (
                    <button
                      key={player.name}
                      onClick={() => setTopScorer(player.name)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors text-left ${
                        topScorer === player.name
                          ? "bg-canal-yellow text-canal-black"
                          : "bg-canal-gray-mid text-white hover:bg-canal-gray-light"
                      }`}
                    >
                      <span className="block truncate">{player.flag} {player.name}</span>
                      <span className={`block text-xs font-normal truncate ${topScorer === player.name ? "text-canal-black/60" : "text-canal-gray-muted"}`}>
                        {player.country}
                      </span>
                    </button>
                  ))}
                </div>
                {topScorer && !TOP_SCORERS.some(
                  (p) => p.name === topScorer && (
                    p.name.toLowerCase().includes(topScorerSearch.toLowerCase()) ||
                    p.country.toLowerCase().includes(topScorerSearch.toLowerCase())
                  )
                ) && (
                  <div className="flex items-center gap-2 bg-canal-gray-mid rounded-xl px-4 py-2.5 text-sm">
                    <span>⚽</span>
                    <span className="font-bold text-white flex-1">{topScorer}</span>
                    <button onClick={() => { setTopScorer(""); setTopScorerSearch(""); }} className="text-canal-gray-muted hover:text-white text-xs">✕</button>
                  </div>
                )}
                <div className="flex gap-2">
                  {editing.top_scorer && (
                    <button
                      onClick={() => setEditing((e) => ({ ...e, top_scorer: false }))}
                      className="flex-1 py-3 rounded-xl bg-canal-gray-mid text-white font-black"
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={async () => { await save("top_scorer", topScorer); setEditing((e) => ({ ...e, top_scorer: false })); }}
                    disabled={!topScorer.trim() || saving === "top_scorer"}
                    className="flex-1 py-3 rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-40"
                  >
                    {saving === "top_scorer" ? "Enregistrement…" : done.top_scorer ? "✅ Sauvegardé !" : "Valider mon choix"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Série parfaite */}
          <div className="canal-card">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${saved.perfect_streak ? "bg-canal-yellow/20" : "bg-canal-gray-mid"}`}>
                <Zap size={20} className={saved.perfect_streak ? "text-canal-yellow" : "text-canal-gray-muted"} />
              </div>
              <div className="flex-1">
                <p className="font-black text-white">Série parfaite</p>
                <p className="text-xs text-canal-gray-muted">+5 pts bonus pour 3 scores exacts d'affilée</p>
              </div>
              {saved.perfect_streak ? (
                <span className="text-canal-yellow font-black">+{saved.perfect_streak} pts ✅</span>
              ) : (
                <span className="text-canal-gray-muted text-xs">Auto</span>
              )}
            </div>
          </div>

          {/* Barème */}
          <div className="canal-card space-y-3">
            <p className="font-black text-white text-sm uppercase tracking-wider">Barème des points</p>
            {[
              { label: "Score exact", pts: 10, icon: "🎯" },
              { label: "Bon résultat (V/N/D)", pts: 5, icon: "✅" },
              { label: "Bonne différence de buts", pts: 3, icon: "↔️" },
              { label: "Mauvais pronostic", pts: 0, icon: "❌" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-sm text-canal-gray-muted">{r.icon} {r.label}</span>
                <span className={`text-sm font-black ${r.pts > 0 ? "text-canal-yellow" : "text-canal-gray-muted"}`}>
                  {r.pts > 0 ? `+${r.pts} pts` : "0 pt"}
                  {r.pts > 0 && <span className="text-xs font-normal text-canal-gray-muted ml-1">× phase</span>}
                </span>
              </div>
            ))}
            <div className="border-t border-canal-gray-light pt-3 space-y-1">
              {[
                ["Phase de groupes", "×1", "max 10 pts"],
                ["Huitièmes", "×1.5", "max 15 pts"],
                ["Quarts", "×2", "max 20 pts"],
                ["Demi-finales", "×2.5", "max 25 pts"],
                ["3ème place", "×2", "max 20 pts"],
                ["Finale", "×3", "max 30 pts"],
              ].map(([phase, mult, max]) => (
                <div key={phase} className="flex justify-between text-xs">
                  <span className="text-canal-gray-muted">{phase}</span>
                  <span className="text-white font-bold">{mult}</span>
                  <span className="text-canal-gray-muted">{max}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-canal-gray-muted border-t border-canal-gray-light pt-2">
              ⚠️ Les points ne se cumulent pas. Seul le meilleur barème s'applique par match.
              Temps réglementaire uniquement — les TAB ne comptent pas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PredHistoryRow({ pred }: { pred: PredRow }) {
  const m = pred.match;
  if (!m) return null;

  const isFinished = m.status === "finished";
  const isLive = m.status === "live";
  const isPending = m.status === "upcoming";
  const isExact = isFinished && m.score_a === pred.predicted_score_a && m.score_b === pred.predicted_score_b;
  const pts = pred.points_awarded ?? 0;

  return (
    <Link href={`/matches/${pred.match_id}`}>
      <div className={`canal-card p-3 flex items-center gap-3 hover:border-canal-yellow/30 transition-colors cursor-pointer ${
        isExact ? "border border-canal-yellow/40" : ""
      }`}>
        {/* Teams */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-canal-gray-muted mb-0.5"><LocalTime date={m.starts_at} variant="date" />{m.phase ? ` · ${m.phase}` : ""}</p>
          <p className="font-bold text-sm text-white truncate">
            {teamFlag(m.flag_a, m.team_a)} {m.team_a} <span className="text-canal-gray-muted font-normal">vs</span> {m.team_b} {teamFlag(m.flag_b, m.team_b)}
          </p>
        </div>

        {/* Prono */}
        <div className="text-center shrink-0">
          <p className="text-xs text-canal-gray-muted">Prono</p>
          <p className="font-black text-sm text-white">{pred.predicted_score_a}–{pred.predicted_score_b}</p>
        </div>

        {/* Result */}
        {(isFinished || isLive) && (
          <div className="text-center shrink-0">
            <p className="text-xs text-canal-gray-muted">{isLive ? "En cours" : "Résultat"}</p>
            <p className="font-black text-sm text-white">{m.score_a ?? 0}–{m.score_b ?? 0}</p>
          </div>
        )}

        {/* Points */}
        <div className="text-right shrink-0 w-16">
          {isLive ? (
            <span className="text-xs text-red-400 font-bold flex items-center gap-1 justify-end">
              <span className="live-dot" /> Live
            </span>
          ) : isPending ? (
            <span className="text-xs text-canal-gray-muted flex items-center gap-1 justify-end">
              <Clock size={10} /> En attente
            </span>
          ) : isFinished && m.is_settled ? (
            <>
              <p className={`font-black text-base ${pts > 0 ? "text-canal-yellow" : "text-canal-gray-muted"}`}>
                {pts > 0 ? `+${pts}` : "0"}
              </p>
              <p className="text-xs text-canal-gray-muted">{scoreLabel(pts)}</p>
            </>
          ) : isFinished ? (
            <span className="text-xs text-canal-gray-muted flex items-center gap-1 justify-end">
              <Target size={10} /> Calcul en cours
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
