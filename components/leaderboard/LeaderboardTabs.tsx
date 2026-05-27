"use client";

// Onglets de classements — évite de tout empiler sur une page illisible.
// Binômes / Individuel / Pronos / Quiz / Services. Pronos & Quiz réutilisent
// les colonnes déjà calculées par getIndividualLeaderboard (re-tri).

import { useState } from "react";
import Link from "next/link";
import { LeaderboardTable } from "./LeaderboardTable";
import type { LeaderboardRow } from "@/lib/supabase/types";
import type { IndividualRow } from "@/lib/data/teams";
import type { ServiceLeaderboardRow } from "@/lib/data/users";

type Tab = "teams" | "individual" | "pronos" | "quiz" | "services";

const TABS: { id: Tab; label: string }[] = [
  { id: "teams", label: "👥 Binômes" },
  { id: "individual", label: "🏅 Individuel" },
  { id: "pronos", label: "🎯 Pronos" },
  { id: "quiz", label: "🧠 Quiz" },
  { id: "services", label: "🏢 Services" },
];

function medal(rank: number) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
}

// Liste de joueurs classés selon une métrique (total / pronos / quiz).
function PlayerList({ rows, metric }: { rows: IndividualRow[]; metric: "total" | "pronos" | "quiz" }) {
  const ranked = [...rows].sort((a, b) => b[metric] - a[metric]);
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
              <p className="text-[11px] text-canal-gray-muted truncate">
                {r.team_name ?? "Sans binôme"}
                {metric === "total" && (
                  <span className="text-canal-gray-muted/70"> · 🎯{r.pronos} 🧠{r.quiz} ⚽{r.babyfoot} 🎉{r.animations}</span>
                )}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-canal-yellow text-lg tabular-nums">{r[metric]}</p>
              <p className="text-[10px] text-canal-gray-muted">
                {metric === "total" ? "points" : metric === "pronos" ? "pts pronos" : "pts quiz"}
              </p>
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
  const [tab, setTab] = useState<Tab>("teams");
  const teamsSorted = [...teamRows].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      {/* Barre d'onglets — scroll horizontal sur mobile */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              tab === t.id ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-canal-gray-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* BINÔMES : podium (si ≥2 équipes) + tableau */}
      {tab === "teams" && (
        <div className="space-y-4">
          {teamsSorted.length >= 2 && (
            <div className="flex items-end justify-center gap-3 h-32">
              {[teamsSorted[1], teamsSorted[0], teamsSorted[2]].map((row, i) => {
                if (!row) return <div key={i} className="w-24" />;
                const heights = ["h-20", "h-28", "h-16"];
                const labels = ["🥈", "🥇", "🥉"];
                return (
                  <Link key={row.team.id} href={`/teams/${row.team.id}`} className="flex flex-col items-center gap-1 w-24 group">
                    <span className="text-sm font-bold text-white text-center leading-tight group-hover:text-canal-yellow transition-colors">{row.team.name}</span>
                    <span className="text-canal-yellow font-black">{row.total}pts</span>
                    <div className={`${heights[i]} w-full bg-canal-gray rounded-t-lg flex items-center justify-center border border-canal-gray-light group-hover:border-canal-yellow/50 transition-colors`}>
                      <span className="text-2xl">{labels[i]}</span>
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
          <p className="text-canal-gray-muted text-xs mb-3">Score perso : pronos + quiz + babyfoot + animations du binôme.</p>
          <PlayerList rows={individualRows} metric="total" />
        </div>
      )}

      {tab === "pronos" && (
        <div>
          <p className="text-canal-gray-muted text-xs mb-3">Classement sur les seuls points de <span className="text-white font-bold">pronostics</span> (pondérés).</p>
          <PlayerList rows={individualRows} metric="pronos" />
        </div>
      )}

      {tab === "quiz" && (
        <div>
          <p className="text-canal-gray-muted text-xs mb-3">Classement sur les seuls points de <span className="text-white font-bold">quiz</span> (pondérés).</p>
          <PlayerList rows={individualRows} metric="quiz" />
        </div>
      )}

      {tab === "services" && (
        <div>
          <p className="text-canal-gray-muted text-xs mb-3">Moyenne de points par personne — comparaison équitable entre services.</p>
          <div className="space-y-2">
            {serviceRows.map((row) => (
              <div key={row.service.id} className={`canal-card flex items-center ${row.rank === 1 ? "border border-canal-yellow/30" : ""}`}>
                <div className="w-8 text-center font-black text-lg flex-shrink-0">{medal(row.rank)}</div>
                <div className="flex-1 min-w-0 ml-1">
                  <p className="font-bold text-white truncate text-sm">{row.service.name}</p>
                  <p className="text-xs text-canal-gray-muted">{row.members} pers. · {row.total} pts au total</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-canal-yellow text-lg tabular-nums">{row.average}</p>
                  <p className="text-[11px] text-canal-gray-muted">pts / pers.</p>
                </div>
              </div>
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
