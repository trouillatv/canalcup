"use client";

// Onglets de classements — évite de tout empiler sur une page illisible.
// Binômes / Individuel / Pronos / Quiz / Services. Pronos & Quiz réutilisent
// les colonnes déjà calculées par getIndividualLeaderboard (re-tri).

import { useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics/track";
import { LeaderboardTable } from "./LeaderboardTable";
import { RecentForm } from "./RecentForm";
import type { LeaderboardRow } from "@/lib/supabase/types";
import type { IndividualRow } from "@/lib/data/teams";
import type { ServiceLeaderboardRow } from "@/lib/data/users";

type Tab = "general" | "teams" | "individual" | "pronos" | "forme" | "quiz" | "services";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "🏆 Général" },
  { id: "teams", label: "👥 Binômes" },
  { id: "individual", label: "🧍 Individuel" },
  { id: "pronos", label: "🎯 Pronos" },
  { id: "forme", label: "🔥 Forme" },
  { id: "quiz", label: "🧠 Quiz" },
  { id: "services", label: "🏢 Services" },
];

function medal(rank: number) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
}

// Liste de joueurs classés selon une métrique.
//  general = total (pronos+quiz+baby+anim) · perso = pronos+quiz · pronos · quiz
type PlayerMetric = "general" | "perso" | "pronos" | "quiz";
function PlayerList({ rows, metric }: { rows: IndividualRow[]; metric: PlayerMetric }) {
  const val = (r: IndividualRow) =>
    metric === "general" ? r.total : metric === "perso" ? r.pronos + r.quiz : metric === "pronos" ? r.pronos : r.quiz;
  const unit = metric === "general" ? "points" : metric === "perso" ? "pts perso" : metric === "pronos" ? "pts pronos" : "pts quiz";
  const ranked = [...rows].sort((a, b) => val(b) - val(a));
  return (
    <div className="space-y-2">
      {ranked.map((r, i) => {
        const rank = i + 1;
        return (
          <Link
            key={r.user_id}
            href={`/joueur/${r.user_id}`}
            className={`canal-card flex items-center hover:bg-canal-gray-mid transition-colors ${rank === 1 ? "border border-canal-yellow/30" : ""}`}
          >
            <div className="w-8 text-center font-black text-lg flex-shrink-0">{medal(rank)}</div>
            <div className="flex-1 min-w-0 ml-1">
              <p className="font-bold text-white truncate text-sm">{r.display_name}</p>
              {r.title && (
                <p className={`text-[11px] font-bold truncate flex items-center gap-1 ${r.title.exclusive ? "text-canal-yellow" : "text-canal-gray-muted"}`}>
                  <span>{r.title.emoji}</span>{r.title.label}
                </p>
              )}
              <p className="text-[11px] text-canal-gray-muted truncate">
                {r.team_name ?? "Sans binôme"}
                {metric === "general" && (
                  <span className="text-canal-gray-muted/70"> · 🎯{r.pronosCount} pronos 🧠{r.quizCount} quiz</span>
                )}
                {metric === "perso" && (
                  <span className="text-canal-gray-muted/70"> · 🎯{r.pronosCount} pronos 🧠{r.quizCount} quiz</span>
                )}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-canal-yellow text-lg tabular-nums">{val(r)}</p>
              <p className="text-[10px] text-canal-gray-muted">{unit}</p>
              {metric === "quiz" && r.quiz > 0 && (
                <p className="text-[10px] text-canal-gray-muted/80 mt-0.5">
                  → <b className="text-white/80">{r.quizGlobal}</b> au général
                </p>
              )}
            </div>
          </Link>
        );
      })}
      {ranked.length === 0 && (
        <div className="canal-card text-center py-6 text-canal-gray-muted text-sm">Personne ici pour l&apos;instant.</div>
      )}
    </div>
  );
}

export function LeaderboardTabs({
  teamRows,
  individualRows,
  serviceRows,
}: {
  teamRows: LeaderboardRow[];
  individualRows: IndividualRow[];
  serviceRows: ServiceLeaderboardRow[];
}) {
  const [tab, setTab] = useState<Tab>("general");
  const teamsSorted = [...teamRows].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      {/* Barre d'onglets — scroll horizontal sur mobile */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); track(`/leaderboard#${t.id}`); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              tab === t.id ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-canal-gray-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* GÉNÉRAL : tous les points confondus, par joueur */}
      {tab === "general" && (
        <div>
          <p className="text-canal-gray-muted text-xs mb-3">
            Tous les points confondus : pronos + quiz + babyfoot + animations du binôme.
            <span className="block mt-1 text-canal-gray-muted/80">🧠 Le quiz compte ici <b className="text-white/80">pondéré (5→50) selon le score</b> (meilleur = 50 pts, plus faible participant = 5) — voir l&apos;onglet Quiz pour le détail.</span>
          </p>
          <PlayerList rows={individualRows} metric="general" />
        </div>
      )}

      {/* BINÔMES : podium (si ≥2 équipes) + tableau */}
      {tab === "teams" && (
        <div className="space-y-4">
          {teamsSorted.length >= 2 && (
            <div className="flex items-end justify-center gap-2 sm:gap-3 h-36 sm:h-32 pt-2 overflow-hidden">
              {[teamsSorted[1], teamsSorted[0], teamsSorted[2]].map((row, i) => {
                if (!row) return <div key={i} className="w-24" />;
                const heights = ["h-16 sm:h-20", "h-24 sm:h-28", "h-14 sm:h-16"];
                const labels = ["🥈", "🥇", "🥉"];
                return (
                  <Link key={row.team.id} href={`/teams/${row.team.id}`} className="flex flex-col items-center gap-1 w-24 group">
                    <span className="text-sm font-bold text-white text-center leading-tight group-hover:text-canal-yellow transition-colors">{row.team.name}</span>
                    <span className="text-canal-yellow font-black">{row.total}pts</span>
                    <div className={`${heights[i]} w-full bg-canal-gray rounded-t-lg flex items-center justify-center border border-canal-gray-light group-hover:border-canal-yellow/50 transition-colors`}>
                      <span className="text-xl sm:text-2xl leading-none">{labels[i]}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          {teamsSorted.length === 0 ? (
            <div className="canal-card text-center py-6 text-canal-gray-muted text-sm">Aucun binôme classé pour l&apos;instant.</div>
          ) : (
            <LeaderboardTable rows={teamsSorted} />
          )}
        </div>
      )}

      {tab === "individual" && (
        <div>
          <p className="text-canal-gray-muted text-xs mb-2">Score perso : <span className="text-white font-bold">pronos + quiz</span> uniquement (hors points du binôme).</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3 px-0.5">
            <span className="text-canal-gray-muted">🎯 Résultat correct <span className="text-canal-yellow font-bold">+5 pts</span></span>
            <span className="text-canal-gray-muted">🎰 Score exact <span className="text-canal-yellow font-bold">+10 pts</span></span>
            <span className="text-canal-gray-muted">⚡ Quiz rapide <span className="text-canal-yellow font-bold">+5 pts</span></span>
            <span className="text-canal-gray-muted">🧠 Quiz correct <span className="text-canal-yellow font-bold">+3 pts</span></span>
          </div>
          <PlayerList rows={individualRows} metric="perso" />
        </div>
      )}

      {tab === "pronos" && (
        <div>
          <p className="text-canal-gray-muted text-xs mb-2">Classement sur les seuls points de <span className="text-white font-bold">pronostics</span>.</p>
          <div className="canal-card mb-3 space-y-2.5 text-xs">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-canal-gray-muted">🎰 Score exact <span className="text-canal-yellow font-bold">+10 pts</span></span>
              <span className="text-canal-gray-muted">🎯 Bon résultat (V/N/D) <span className="text-canal-yellow font-bold">+5 pts</span></span>
            </div>
            <div className="border-t border-canal-gray-mid pt-2">
              <p className="text-[10px] font-bold text-canal-gray-muted uppercase tracking-wide mb-1.5">Multiplicateurs phases finales</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="text-canal-gray-muted">Groupes <span className="text-white font-semibold">×1</span></span>
                <span className="text-canal-gray-muted">1/8 <span className="text-canal-yellow font-bold">×1.5</span></span>
                <span className="text-canal-gray-muted">1/4 <span className="text-canal-yellow font-bold">×2</span></span>
                <span className="text-canal-gray-muted">½ finale <span className="text-canal-yellow font-bold">×2.5</span></span>
                <span className="text-canal-gray-muted">3ème place <span className="text-canal-yellow font-bold">×2</span></span>
                <span className="text-canal-yellow/90 font-bold">Finale ×3</span>
              </div>
              <p className="text-[10px] text-canal-gray-muted/60 mt-1.5">Ex. score exact en finale = 10 × 3 = <span className="text-canal-yellow font-bold">30 pts</span></p>
            </div>
          </div>
          <PlayerList rows={individualRows} metric="pronos" />
        </div>
      )}

      {tab === "forme" && <RecentForm />}

      {tab === "quiz" && (
        <div>
          <p className="text-canal-gray-muted text-xs mb-2">Classement du <span className="text-white font-bold">Championnat Quiz</span> — points <span className="text-white font-bold">réels</span> (Live 100 %, Solo réduit).</p>
          <div className="canal-card mb-3 text-[11px] text-canal-gray-muted leading-relaxed">
            🧠 <b className="text-white">Deux comptes distincts.</b> Le <b className="text-white">championnat quiz</b> (ci-dessous)
            garde les points réels et qualifie pour la finale. Au <b className="text-white">classement général</b>, la
            contribution quiz est <b className="text-white">normalisée entre 5 et 50 selon le score</b> (meilleur = 50 pts,
            plus faible participant = 5, absent = 0) pour ne pas écraser pronos / babyfoot / animations. La mention
            « → X au général » indique cette contribution pondérée.
          </div>
          <PlayerList rows={individualRows} metric="quiz" />
        </div>
      )}

      {tab === "services" && (
        <div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-canal-gray-muted text-xs">
              Moyenne de points par personne — comparaison équitable entre services.
            </p>
            <Link
              href="/services"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-canal-yellow/30 bg-canal-yellow/10 px-3 py-1 text-[11px] font-black text-canal-yellow hover:bg-canal-yellow/15 transition-colors"
            >
              Voir la page
            </Link>
          </div>
          <div className="space-y-2">
            {serviceRows.map((row) => (
              <Link key={row.service.id} href={`/services/${row.service.id}`} className={`canal-card flex items-center hover:bg-canal-gray-mid transition-colors ${row.rank === 1 ? "border border-canal-yellow/30" : ""}`}>
                <div className="w-8 text-center font-black text-lg flex-shrink-0">{medal(row.rank)}</div>
                <div className="flex-1 min-w-0 ml-1">
                  <p className="font-bold text-white truncate text-sm">{row.service.name}</p>
                  <p className="text-xs text-canal-gray-muted">{row.members} pers. · {row.total} pts au total</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-canal-yellow text-lg tabular-nums">{row.average}</p>
                  <p className="text-[11px] text-canal-gray-muted">pts / pers.</p>
                </div>
              </Link>
            ))}
            {serviceRows.length === 0 && (
              <div className="canal-card text-center py-6 text-canal-gray-muted text-sm">Aucun service classé.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
