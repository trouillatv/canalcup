"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Newspaper, TrendingUp, Shirt, BarChart3, Award, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/shared/Flag";
import { formCode, type WCTeam } from "@/lib/football/wc-teams";
import { groupLetterForTeam } from "@/lib/football/groups-2026";
import { wcTeamHref } from "@/lib/football/wc-teams-index";
import { getFIFARank } from "@/lib/football/fifa-ranks";

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

interface PlayerCompStat {
  player_name: string;
  matches: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  motm: number;
  avg_rating: number | null;
}

interface LiveResult {
  match_id: string;
  phase: string;
  is_knockout: boolean;
  opponent: string;
  opponent_flag?: string | null;
  gf: number;
  ga: number;
  result: "V" | "N" | "D";
  date: string;
}

type EffectifView = "club" | "stats" | "selection";

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// Normalisation pour rapprocher les noms entre sources (Transfermarkt ↔
// API-Football/Gemini) : minuscules, sans accents/ponctuation.
function normName(n: string): string {
  return n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function ratingBadgeClass(r: number | null): string {
  if (r == null) return "bg-canal-gray-mid text-canal-gray-muted";
  if (r >= 7.5) return "bg-green-500/20 text-green-400";
  if (r >= 6.5) return "bg-canal-yellow/15 text-canal-yellow";
  return "bg-red-500/15 text-red-400";
}

function PlayerEffectifRow({
  p,
  view,
  stat,
}: {
  p: WCTeam["players"][number];
  view: EffectifView;
  stat: PlayerCompStat | undefined;
}) {
  const hasSel = p.caps != null || p.selection_goals != null;
  const subtitle =
    view === "club"
      ? `${p.position ?? ""}${p.club ? ` · ${p.club}` : ""}`
      : view === "selection"
        ? `${p.position ?? ""}${p.club ? ` · ${p.club}` : ""}`
        : stat
          ? `${stat.matches} match${stat.matches > 1 ? "s" : ""}${stat.motm ? ` · ⭐ ${stat.motm}` : ""}`
          : `${p.position ?? ""} · pas encore joué`;

  return (
    <div className="canal-card p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-sm truncate">{p.name}</p>
        <p className="text-xs text-canal-gray-muted truncate">{subtitle}</p>
      </div>

      {view === "club" && (
        p.value && (
          <span className="text-canal-yellow font-black text-sm shrink-0 tabular-nums">
            {p.value}
          </span>
        )
      )}

      {view === "selection" && (
        <div className="flex items-center gap-3 shrink-0 tabular-nums">
          {p.age != null && (
            <span className="text-xs text-canal-gray-muted" title="Âge">
              🎂 {p.age} ans
            </span>
          )}
          {hasSel ? (
            <>
              <span className="text-xs text-white" title="Sélections (caps)">
                🎽 {p.caps ?? "—"}
              </span>
              <span className="text-xs text-canal-yellow font-bold" title="Buts en sélection">
                ⚽ {p.selection_goals ?? 0}
              </span>
              {(p.selection_yellow_cards != null || p.selection_red_cards != null) && (
                <span className="text-xs" title="Cartons en sélection">
                  🟨 {p.selection_yellow_cards ?? 0}
                  {p.selection_red_cards ? ` 🟥 ${p.selection_red_cards}` : ""}
                </span>
              )}
            </>
          ) : p.age == null ? (
            <span className="text-xs text-canal-gray-muted">—</span>
          ) : null}
        </div>
      )}

      {view === "stats" && (
        <div className="flex items-center gap-2 shrink-0 tabular-nums">
          <span className="text-xs text-white" title="Buts">⚽ {stat?.goals ?? 0}</span>
          <span className="text-xs text-canal-gray-muted" title="Passes décisives">🅰️ {stat?.assists ?? 0}</span>
          <span className="text-xs" title="Cartons">
            🟨 {stat?.yellow_cards ?? 0}{stat?.red_cards ? ` 🟥 ${stat.red_cards}` : ""}
          </span>
          <span
            className={cn(
              "text-xs font-black px-1.5 py-0.5 rounded",
              ratingBadgeClass(stat?.avg_rating ?? null)
            )}
            title="Note moyenne"
          >
            {stat?.avg_rating != null ? stat.avg_rating.toFixed(1) : "—"}
          </span>
        </div>
      )}
    </div>
  );
}

// Ligne « stats compétition » — affiche un VRAI joueur ayant joué (poules + KO),
// directement depuis l'agrégat live (pas le roster statique), pour éviter le
// « vide » dû aux écarts de noms roster ↔ API.
function CompStatRow({ s }: { s: PlayerCompStat }) {
  return (
    <div className="canal-card p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-sm truncate">{s.player_name}</p>
        <p className="text-xs text-canal-gray-muted">
          {s.matches} match{s.matches > 1 ? "s" : ""}{s.motm ? ` · ⭐ ${s.motm}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 tabular-nums">
        <span className="text-xs text-white" title="Buts">⚽ {s.goals}</span>
        <span className="text-xs text-canal-gray-muted" title="Passes décisives">🅰️ {s.assists}</span>
        <span className="text-xs" title="Cartons">
          🟨 {s.yellow_cards}{s.red_cards ? ` 🟥 ${s.red_cards}` : ""}
        </span>
        {s.avg_rating != null && (
          <span className={cn("text-xs font-black px-1.5 py-0.5 rounded", ratingBadgeClass(s.avg_rating))} title="Note moyenne">
            {s.avg_rating.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

export function WCTeamFiche({ team }: { team: WCTeam }) {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/bracket");
  };
  const [tab, setTab] = useState<TabKey>("effectif");
  const [effectifView, setEffectifView] = useState<EffectifView>("club");
  const [live, setLive] = useState<{ players: PlayerCompStat[]; results: LiveResult[]; form: string[] } | null>(null);
  const grouped = groupPlayers(team.players);
  // Poule officielle (bracket) de l'équipe — null si hors tirage des 48.
  const poolLetter = groupLetterForTeam(team.name);
  const fifaEntry = getFIFARank(team.name);

  // Charge en une fois les données VIVES de la compétition : stats joueurs +
  // résultats réels (poules ET phase finale) + forme. Sert tous les onglets.
  useEffect(() => {
    let alive = true;
    fetch(`/api/wc-team/${team.slug}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { players?: PlayerCompStat[]; results?: LiveResult[]; form?: string[] } | null) => {
        if (!alive) return;
        setLive({ players: d?.players ?? [], results: d?.results ?? [], form: d?.form ?? [] });
      })
      .catch(() => { if (alive) setLive({ players: [], results: [], form: [] }); });
    return () => { alive = false; };
  }, [team.slug]);

  const compStats = useMemo(() => {
    const map: Record<string, PlayerCompStat> = {};
    for (const s of live?.players ?? []) map[normName(s.player_name)] = s;
    return map;
  }, [live]);
  const statFor = (name: string): PlayerCompStat | undefined => compStats[normName(name)];
  const hasAnyStats = (live?.players.length ?? 0) > 0;
  // Résultats & forme RÉELS (poules + KO) ; fallback JSON statique pré-tournoi.
  const liveResults = live?.results ?? [];
  const liveForm = live && live.form.length > 0 ? live.form : null;

  // Stats sélection : présentes uniquement si data/wc-teams.json a été enrichi
  // (script Python, après validation). Sinon dégradation propre.
  const selEnriched = team.players.filter((p) => p.caps != null);
  const hasSelection = selEnriched.length > 0;
  const selSource = selEnriched.find((p) => p.stats_source)?.stats_source ?? "Transfermarkt";
  const selUpdatedAt = selEnriched
    .map((p) => p.stats_updated_at)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <div className="px-4 py-4 space-y-5 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          aria-label="Retour à l'écran précédent"
          className="flex items-center gap-1 text-canal-gray-muted hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Retour</span>
        </button>
        <span className="text-canal-gray-muted text-sm">Sélections · Coupe du Monde 2026</span>
      </div>

      <div className="canal-card border border-canal-yellow/20">
        <div className="flex items-center gap-4">
          <Flag flag={null} name={team.name} className="h-11 w-auto rounded-sm shrink-0" emojiClassName="text-5xl leading-none" />
          <div className="flex-1 min-w-0">
            <h1 className="canal-headline text-xl truncate">{team.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
              {poolLetter ? (
                <Link
                  href={`/bracket?group=${poolLetter}`}
                  className="text-canal-yellow text-xs font-bold hover:underline underline-offset-2"
                  title={`Voir la poule ${poolLetter} dans le tableau de la Coupe`}
                >
                  Poule {poolLetter} →
                </Link>
              ) : (
                team.group && (
                  <span className="text-canal-yellow text-xs font-bold">Poule {team.group}</span>
                )
              )}
              {fifaEntry && (
                <span className="text-canal-gray-muted text-xs">
                  FIFA&nbsp;<span className="text-white font-bold">#{fifaEntry.rank}</span>
                  <span className="ml-1 text-canal-gray-muted">({fifaEntry.confederation})</span>
                </span>
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
        {wcTeamHref(team.name) && (
          <div className="mt-3 pt-3 border-t border-canal-gray-light/30">
            <Link
              href={wcTeamHref(team.name)!}
              className="flex items-center gap-2 text-xs font-bold text-canal-yellow hover:text-yellow-300 transition-colors"
            >
              <BarChart2 size={13} />
              Vue tournoi — matchs, classement, stats
              <span className="ml-auto text-canal-yellow/50">→</span>
            </Link>
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

          {grouped.length > 0 && (
            <>
              {/* Bascule Club ↔ Stats compétition */}
              <div className="flex gap-1 bg-canal-gray rounded-xl p-1">
                {([
                  { key: "club", label: "Club & valeur", icon: Shirt },
                  { key: "selection", label: "Stats sélection", icon: Award },
                  { key: "stats", label: "Stats compétition", icon: BarChart3 },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setEffectifView(key)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5",
                      effectifView === key
                        ? "bg-canal-yellow text-canal-black"
                        : "text-canal-gray-muted hover:text-white"
                    )}
                  >
                    <Icon size={13} />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              {effectifView === "selection" && !hasSelection && (
                <p className="canal-card text-center text-canal-gray-muted text-xs py-3">
                  Stats sélection (caps, buts en sélection) à venir — enrichissement
                  Transfermarkt pas encore importé pour cette équipe.
                </p>
              )}

              {effectifView === "selection" && hasSelection && (
                <p className="text-center text-canal-gray-muted text-[11px]">
                  Source&nbsp;: {selSource}
                  {selUpdatedAt ? ` · MAJ ${fmtDate(selUpdatedAt)}` : ""}
                </p>
              )}

              {/* Stats compétition : on liste les VRAIS joueurs ayant joué
                  (poules + phase finale), tirés de l'agrégat live. */}
              {effectifView === "stats" ? (
                live == null ? (
                  <p className="canal-card text-center text-canal-gray-muted text-xs py-3">
                    Chargement des statistiques…
                  </p>
                ) : !hasAnyStats ? (
                  <p className="canal-card text-center text-canal-gray-muted text-xs py-3">
                    Statistiques disponibles dès le coup d&apos;envoi de la compétition (buts, notes, cartons par joueur).
                  </p>
                ) : (
                  <section>
                    <h2 className="text-xs font-bold text-canal-yellow uppercase tracking-wider mb-2">
                      Statistiques compétition ({live!.players.length} joueurs)
                    </h2>
                    <div className="space-y-1.5">
                      {live!.players.map((s) => (
                        <CompStatRow key={s.player_name} s={s} />
                      ))}
                    </div>
                  </section>
                )
              ) : (
                grouped.map((bucket) => (
                  <section key={bucket.label}>
                    <h2 className="text-xs font-bold text-canal-yellow uppercase tracking-wider mb-2">
                      {bucket.label} ({bucket.players.length})
                    </h2>
                    <div className="space-y-1.5">
                      {bucket.players.map((p, i) => (
                        <PlayerEffectifRow
                          key={`${p.name}-${i}`}
                          p={p}
                          view={effectifView}
                          stat={statFor(p.name)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* ── INFOS GÉNÉRALES ── */}
      {tab === "infos" && (
        <div className="space-y-5">
          <section>
            <h2 className="text-xs font-bold text-canal-yellow uppercase tracking-wider mb-2">
              {liveResults.length > 0 ? "Parcours Coupe du Monde" : "Derniers résultats"}
            </h2>
            {liveResults.length > 0 ? (
              // Résultats RÉELS de la compétition : poules ET phase finale.
              <div className="canal-card divide-y divide-canal-gray-light/20">
                {liveResults.map((r) => (
                  <Link
                    key={r.match_id}
                    href={`/matches/${r.match_id}`}
                    className="flex items-center gap-2 py-2 first:pt-0 last:pb-0 hover:bg-canal-gray/30 rounded-lg px-1 -mx-1 transition-colors"
                  >
                    <span
                      className={cn(
                        "text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 w-12 text-center",
                        r.is_knockout ? "bg-canal-yellow/15 text-canal-yellow" : "bg-canal-gray-mid text-canal-gray-muted"
                      )}
                    >
                      {r.phase}
                    </span>
                    <Flag flag={r.opponent_flag ?? null} name={r.opponent} className="h-4 w-auto rounded-sm shrink-0" emojiClassName="text-base" />
                    <span className="flex-1 text-sm text-white truncate">{r.opponent}</span>
                    <span className="text-sm font-black tabular-nums text-white shrink-0">{r.gf}–{r.ga}</span>
                    <span
                      className={cn(
                        "text-[11px] font-black w-5 text-center shrink-0",
                        r.result === "V" ? "text-green-400" : r.result === "D" ? "text-red-400" : "text-canal-gray-muted"
                      )}
                    >
                      {r.result}
                    </span>
                  </Link>
                ))}
              </div>
            ) : team.recentScores.length > 0 ? (
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-canal-yellow uppercase tracking-wider">
                Forme — 5 derniers matchs
              </h2>
              {fifaEntry && (
                <span className="text-xs text-canal-gray-muted">
                  FIFA&nbsp;<span className="text-white font-bold">#{fifaEntry.rank}</span>
                  <span className="ml-1">({fifaEntry.confederation})</span>
                </span>
              )}
            </div>
            {(liveForm ?? team.form).length > 0 ? (
              <div className="canal-card flex flex-wrap gap-2">
                {(liveForm ?? team.form).map((f, i) => {
                  const c = liveForm ? f : formCode(f);
                  return (
                    <span
                      key={i}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg border text-xs font-bold",
                        FORM_STYLE[c] ?? FORM_STYLE["?"]
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
              <p className="text-canal-gray-muted text-xs">Classement FIFA</p>
              {fifaEntry ? (
                <>
                  <p className="text-white font-black text-xl mt-1">#{fifaEntry.rank}</p>
                  <p className="text-canal-gray-muted text-xs mt-0.5">{fifaEntry.confederation}</p>
                </>
              ) : (
                <p className="text-white font-black text-xl mt-1">—</p>
              )}
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
