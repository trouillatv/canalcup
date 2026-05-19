"use client";

import Link from "next/link";
import { useState } from "react";
import { cn, teamFlag, toNCDate, toNCTime } from "@/lib/utils";
import type { Match, PredictionTrend } from "@/lib/supabase/types";
import { getResult, scoreLabel } from "@/lib/scoring";
import { Star, Clock, ChevronRight, Check, Lock } from "lucide-react";
import { Countdown } from "./Countdown";
import { TeamLink } from "@/components/teams/TeamLink";

interface SavedPrediction {
  score_a: number;
  score_b: number;
  points?: number;
}

interface MatchCardProps {
  match: Match;
  trend?: PredictionTrend;
  savedPrediction?: SavedPrediction;
  compact?: boolean;
}

function ScorePredictInput({
  match,
  savedPrediction,
  onSave,
}: {
  match: Match;
  savedPrediction?: SavedPrediction;
  onSave: (a: number, b: number) => Promise<void>;
}) {
  const [scoreA, setScoreA] = useState(savedPrediction?.score_a ?? 1);
  const [scoreB, setScoreB] = useState(savedPrediction?.score_b ?? 1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!savedPrediction);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasStarted = new Date(match.starts_at) <= new Date();

  if (hasStarted && savedPrediction) {
    const result = getResult(savedPrediction.score_a, savedPrediction.score_b);
    const label = result === "A" ? match.team_a : result === "B" ? match.team_b : "Nul";
    return (
      <div className="mt-3 flex items-center justify-between px-3 py-2 bg-canal-gray-mid rounded-xl">
        <div className="flex items-center gap-2">
          <Lock size={12} className="text-canal-gray-muted" />
          <span className="text-xs text-canal-gray-muted">Prono verrouillé</span>
        </div>
        <span className="text-sm font-black text-white">
          {savedPrediction.score_a} – {savedPrediction.score_b}
          <span className="text-canal-gray-muted font-normal text-xs ml-1">({label})</span>
        </span>
        {savedPrediction.points !== undefined && savedPrediction.points > 0 && (
          <span className="text-canal-yellow font-black text-sm">+{savedPrediction.points} pts</span>
        )}
      </div>
    );
  }

  if (hasStarted) return null;

  const resultLabel = () => {
    const r = getResult(scoreA, scoreB);
    if (r === "A") return `${match.team_a} gagne`;
    if (r === "B") return `${match.team_b} gagne`;
    return "Match nul";
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await onSave(scoreA, scoreB);
      setSaved(true);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Échec de l'enregistrement.");
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-canal-gray-muted text-center">Votre pronostic</p>
      <div className="flex items-center gap-3 justify-center">
        {/* Score A */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-canal-gray-muted truncate max-w-[64px] text-center">{match.team_a}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={scoreA}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => { setSaved(false); setScoreA(Math.min(20, Math.max(0, parseInt(e.target.value, 10) || 0))); }}
            className="w-14 h-10 text-center text-2xl font-black text-white bg-canal-gray-mid border border-canal-gray-light rounded-xl focus:border-canal-yellow outline-none"
          />
        </div>

        <span className="text-canal-gray-muted font-bold text-xl mt-4">–</span>

        {/* Score B */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-canal-gray-muted truncate max-w-[64px] text-center">{match.team_b}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={scoreB}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => { setSaved(false); setScoreB(Math.min(20, Math.max(0, parseInt(e.target.value, 10) || 0))); }}
            className="w-14 h-10 text-center text-2xl font-black text-white bg-canal-gray-mid border border-canal-gray-light rounded-xl focus:border-canal-yellow outline-none"
          />
        </div>

        {/* Valider */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "mt-4 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-black transition-colors",
            saved
              ? "bg-green-800/40 text-green-400 border border-green-700/40"
              : "bg-canal-yellow text-canal-black hover:bg-yellow-400"
          )}
        >
          {saved ? <><Check size={14} /> Sauvé</> : saving ? "…" : "Valider"}
        </button>
      </div>

      {errorMsg ? (
        <p className="text-xs text-center text-red-400 font-bold">{errorMsg}</p>
      ) : (
        <p className="text-xs text-center text-canal-gray-muted">{resultLabel()}</p>
      )}
    </div>
  );
}

export function MatchCard({ match, trend, savedPrediction, compact }: MatchCardProps) {
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const isUpcoming = match.status === "upcoming";

  const handleSavePrediction = async (scoreA: number, scoreB: number) => {
    let res: Response;
    try {
      res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: match.id, predicted_score_a: scoreA, predicted_score_b: scoreB }),
        credentials: "same-origin",
      });
    } catch {
      throw new Error("Réseau indisponible — vérifie ta connexion puis réessaie.");
    }
    if (res.ok) return;
    let serverMsg = "";
    try {
      serverMsg = (await res.json())?.error ?? "";
    } catch {
      /* corps non JSON */
    }
    if (res.status === 401) {
      throw new Error(
        "Session expirée — tu n'es plus connecté. Recharge la page et reconnecte-toi via le lien magique reçu par mail."
      );
    }
    throw new Error(serverMsg || `Échec (HTTP ${res.status}) — réessaie.`);
  };

  return (
    <article className={cn("canal-card", compact && "p-3")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-canal-gray-muted">
          <Clock size={12} />
          <span>{toNCDate(match.starts_at)} — {toNCTime(match.starts_at)} NC</span>
        </div>
        <div className="flex items-center gap-2">
          {match.is_match_of_week && (
            <span className="canal-badge flex items-center gap-1">
              <Star size={10} /> Match de la semaine
            </span>
          )}
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-red-400 font-bold">
              <span className="live-dot" /> LIVE
            </span>
          )}
          {isFinished && (
            <span className="text-xs text-canal-gray-muted">Terminé</span>
          )}
        </div>
      </div>

      {/* Match display */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 flex flex-col items-center">
          <TeamLink
            name={match.team_a}
            flag={teamFlag(match.flag_a, match.team_a)}
            stacked
            flagClassName="text-3xl"
            className="text-sm font-bold text-white text-center leading-tight max-w-full"
            wrapperClassName="max-w-full"
          />
        </div>

        <div className="flex flex-col items-center gap-1">
          {isFinished || isLive ? (
            <div className="flex items-center gap-2">
              <span className="score-display text-3xl">{match.score_a ?? 0}</span>
              <span className="text-canal-gray-muted font-bold text-xl">-</span>
              <span className="score-display text-3xl">{match.score_b ?? 0}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-canal-gray-muted font-black text-xl">VS</span>
              <Countdown startsAt={match.starts_at} />
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center">
          <TeamLink
            name={match.team_b}
            flag={teamFlag(match.flag_b, match.team_b)}
            stacked
            flagClassName="text-3xl"
            className="text-sm font-bold text-white text-center leading-tight max-w-full"
            wrapperClassName="max-w-full"
          />
        </div>
      </div>

      {/* Score prediction — upcoming only */}
      {isUpcoming && !compact && (
        <ScorePredictInput
          match={match}
          savedPrediction={savedPrediction}
          onSave={handleSavePrediction}
        />
      )}

      {/* Prediction result display — finished */}
      {isFinished && savedPrediction && !compact && (
        <div className="mt-3 flex items-center justify-between px-3 py-2 bg-canal-gray-mid rounded-xl">
          <span className="text-xs text-canal-gray-muted">
            Prono : {savedPrediction.score_a}–{savedPrediction.score_b}
          </span>
          {savedPrediction.points !== undefined ? (
            <span className={cn(
              "text-sm font-black",
              savedPrediction.points > 0 ? "text-canal-yellow" : "text-canal-gray-muted"
            )}>
              {savedPrediction.points > 0
                ? `+${savedPrediction.points} pts — ${scoreLabel(savedPrediction.points)}`
                : scoreLabel(0)}
            </span>
          ) : null}
        </div>
      )}

      {/* Trends */}
      {trend && trend.total > 0 && !compact && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-canal-gray-muted mb-1">
            <span>{trend.pct_a}%</span>
            <span className="text-center">{trend.pct_draw}% nul</span>
            <span>{trend.pct_b}%</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden">
            <div className="bg-canal-yellow" style={{ width: `${trend.pct_a}%` }} />
            <div className="bg-canal-gray-light" style={{ width: `${trend.pct_draw}%` }} />
            <div className="bg-white/30" style={{ width: `${trend.pct_b}%` }} />
          </div>
          <div className="text-center text-xs text-canal-gray-muted mt-1">{trend.total} pronostics</div>
        </div>
      )}

      {/* Link to match center */}
      {!compact && (
        <Link
          href={`/matches/${match.id}`}
          className={cn(
            "mt-3 flex items-center justify-center gap-1 text-xs font-bold transition-colors rounded-lg py-2",
            isLive
              ? "text-red-400 hover:text-red-300 bg-red-950/20"
              : "text-canal-gray-muted hover:text-canal-yellow"
          )}
        >
          {isLive ? "🔴 Suivre en direct" : "Centre du match"}
          <ChevronRight size={12} />
        </Link>
      )}
    </article>
  );
}
