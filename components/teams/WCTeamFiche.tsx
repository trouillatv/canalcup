"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Newspaper, TrendingUp } from "lucide-react";
import { teamFlag, cn } from "@/lib/utils";
import { formCode, type WCTeam } from "@/lib/football/wc-teams";

type TabKey = "effectif" | "infos" | "forme";

const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: "effectif", label: "Effectif", icon: Users },
  { key: "infos", label: "Infos générales", icon: Newspaper },
  { key: "forme", label: "Forme & Valeur", icon: TrendingUp },
];

// Regroupe les postes du docs en 4 lignes.
const POSITION_GROUPS: { label: string; match: (p: string) => boolean }[] = [
  { label: "Gardiens", match: (p) => /gardien/i.test(p) },
  { label: "Défenseurs", match: (p) => /défenseur|defenseur|arrière|arriere|latéral|lateral/i.test(p) },
  { label: "Milieux", match: (p) => /milieu/i.test(p) },
  { label: "Attaquants", match: (p) => /attaquant|avant|ailier|buteur/i.test(p) },
];

function groupPlayers(players: WCTeam["players"]) {
  const buckets = POSITION_GROUPS.map((g) => ({ label: g.label, players: [] as WCTeam["players"] }));
  const other: WCTeam["players"] = [];
  for (const p of players) {
    const idx = POSITION_GROUPS.findIndex((g) => g.match(p.position ?? ""));
    if (idx >= 0) buckets[idx].players.push(p);
    else other.push(p);
  }
  if (other.length) buckets.push({ label: "Autres", players: other });
  return buckets.filter((b) => b.players.length > 0);
}

const FORM_STYLE: Record<string, string> = {
  V: "bg-green-500/20 text-green-400 border-green-500/40",
  N: "bg-canal-gray-mid text-canal-gray-muted border-canal-gray-light",
  D: "bg-red-500/20 text-red-400 border-red-500/40",
  "?": "bg-canal-gray-mid text-canal-gray-muted border-canal-gray-light",
};

function ResultBadge({ score }: { score: string }) {
  const c = formCode(score.split(" vs ")[0]);
  return (
    <span
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
        c === "V" ? "bg-green-400" : c === "D" ? "bg-red-400" : "bg-canal-gray-muted"
      )}
    />
  );
}

export function WCTeamFiche({ team }: { team: WCTeam }) {
  const [tab, setTab] = useState<TabKey>("effectif");
  const grouped = groupPlayers(team.players);

  return (
    <div className="px-4 py-4 space-y-5 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/bracket" className="text-canal-gray-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <span className="text-canal-gray-muted text-sm">Sélections · Coupe du Monde 2026</span>
      </div>

      <div className="canal-card border border-canal-yellow/20">
        <div className="flex items-center gap-4">
          <span className="text-5xl leading-none">{teamFlag(null, team.name)}</span>
          <div className="flex-1 min-w-0">
            <h1 className="canal-headline text-xl truncate">{team.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              {team.group && (
                <span className="text-canal-yellow text-xs font-bold">Poule {team.group}</span>
              )}
              {team.squadValue && (
                <span className="text-canal-gray-muted text-xs">
                  Effectif&nbsp;: <span className="text-white font-bold">{team.squadValue}</span>
                </span>
              )}
              <span className="text-canal-gray-muted text-xs">{team.players.length} joueurs</span>
            </div>
          </div>
        </div>
        {team.nextMatch && (
          <div className="mt-3 pt-3 border-t border-canal-gray-light/30">
            <p className="text-xs text-canal-gray-muted">Prochain match officiel</p>
            <p className="text-sm text-white font-bold mt-0.5">⚽ {team.nextMatch}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-canal-gray rounded-xl p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5",
              tab === key ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
            )}
          >
            <Icon size={13} />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* ── EFFECTIF ── */}
      {tab === "effectif" && (
        <div className="space-y-5">
          {grouped.length === 0 && (
            <p className="canal-card text-center text-canal-gray-muted text-sm py-6">
              Effectif non disponible pour cette sélection.
            </p>
          )}
          {grouped.map((bucket) => (
            <section key={bucket.label}>
              <h2 className="text-xs font-bold text-canal-yellow uppercase tracking-wider mb-2">
                {bucket.label} ({bucket.players.length})
              </h2>
              <div className="space-y-1.5">
                {bucket.players.map((p, i) => (
                  <div key={`${p.name}-${i}`} className="canal-card p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{p.name}</p>
                      <p className="text-xs text-canal-gray-muted truncate">
                        {p.position}{p.club ? ` · ${p.club}` : ""}
                      </p>
                    </div>
                    {p.value && (
                      <span className="text-canal-yellow font-black text-sm shrink-0 tabular-nums">
                        {p.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── INFOS GÉNÉRALES ── */}
      {tab === "infos" && (
        <div className="space-y-5">
          <section>
            <h2 className="text-xs font-bold text-canal-yellow uppercase tracking-wider mb-2">
              Derniers résultats
            </h2>
            {team.recentScores.length > 0 ? (
              <div className="canal-card divide-y divide-canal-gray-light/20">
                {team.recentScores.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
                    <ResultBadge score={s} />
                    <span className="text-sm text-white">{s}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="canal-card text-center text-canal-gray-muted text-sm py-4">
                Aucun résultat récent renseigné.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-xs font-bold text-canal-yellow uppercase tracking-wider mb-2">
              Calendrier Coupe du Monde
            </h2>
            {team.calendar.length > 0 ? (
              <div className="space-y-2">
                {team.calendar.map((m, i) => (
                  <div key={i} className="canal-card p-3 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-canal-yellow/15 text-canal-yellow text-xs font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-white">{m}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="canal-card text-center text-canal-gray-muted text-sm py-4">
                Calendrier non communiqué.
              </p>
            )}
          </section>
        </div>
      )}

      {/* ── FORME & VALEUR ── */}
      {tab === "forme" && (
        <div className="space-y-5">
          <section>
            <h2 className="text-xs font-bold text-canal-yellow uppercase tracking-wider mb-2">
              Forme — 5 derniers matchs
            </h2>
            {team.form.length > 0 ? (
              <div className="canal-card flex flex-wrap gap-2">
                {team.form.map((f, i) => {
                  const c = formCode(f);
                  return (
                    <span
                      key={i}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg border text-xs font-bold",
                        FORM_STYLE[c]
                      )}
                    >
                      {f}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="canal-card text-center text-canal-gray-muted text-sm py-4">
                Forme non renseignée.
              </p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3">
            <div className="canal-card text-center">
              <p className="text-canal-gray-muted text-xs">Valeur effectif (est.)</p>
              <p className="text-canal-yellow font-black text-xl mt-1">
                {team.squadValue ?? "—"}
              </p>
            </div>
            <div className="canal-card text-center">
              <p className="text-canal-gray-muted text-xs">Poule (données)</p>
              <p className="text-white font-black text-xl mt-1">{team.group ?? "—"}</p>
            </div>
          </div>

          {team.nextMatch && (
            <div className="canal-card">
              <p className="text-canal-gray-muted text-xs">Prochain match officiel (CDM 2026)</p>
              <p className="text-white font-bold text-sm mt-1">⚽ {team.nextMatch}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
