"use client";

// <BabyfootAdmin /> — ASSISTANT pas-à-pas d'organisation du tournoi (pas un CRUD).
// Rendu dans /babyfoot sous l'onglet « Gestion », visible uniquement pour les
// organisateurs (e-mails de DEFAULT_ADMIN_EMAILS). L'orga est guidé : créer →
// ouvrir inscriptions → gérer les binômes → fermer → format → générer → lancer →
// résultats → podium. Toutes les écritures passent par /api/admin/babyfoot/*
// (isAdminRequest) : c'est LÀ qu'est la vraie sécurité, pas l'affichage.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BABYFOOT, type BabyfootStage } from "@/lib/config/babyfoot";
import type { BabyfootTournament, BabyFootMatch, BabyfootAward } from "@/lib/supabase/types";
import type { BabyfootEntryView } from "@/lib/data/babyfoot";
import { computeChampionshipStandings, type ChampStanding } from "@/lib/babyfoot/standings";
import { pointsForWin } from "@/lib/babyfoot/stakes";
import type { ChampionshipProjection } from "@/lib/babyfoot/format";
import type { PlanningHealth } from "@/lib/babyfoot/health";
import { CheckCircle2, Circle, Loader2, Plus, X, Trophy, Settings, ChevronDown, QrCode } from "lucide-react";

interface AvailableTeam { id: string; name: string; members: string[]; }
interface State {
  tournament: BabyfootTournament;
  entries: BabyfootEntryView[];
  matches: BabyFootMatch[];
  awards: BabyfootAward[];
  projection: ChampionshipProjection;
  health: PlanningHealth;
  availableTeams: AvailableTeam[];
}

const PHASE_ORDER = ["league", "semi", "final", "third"];
const PHASE_LABEL: Record<string, string> = { league: "Championnat", semi: "Demi-finales", final: "Finale", third: "Petite finale" };

async function post(body: Record<string, unknown>, path = "tournament") {
  const res = await fetch(`/api/admin/babyfoot/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

// Étape courante déduite de l'état (jamais choisie par l'orga).
function currentStep(t: BabyfootTournament, matches: BabyFootMatch[]): number {
  const hasMatches = matches.length > 0;
  if (t.status === "finished") return 8;
  if (t.status === "knockout" || t.status === "pools") return 7;
  if (t.status === "draw") return hasMatches ? 6 : 4;
  if (t.registration_open || t.status === "registration") return 3;
  return 2; // draft, pas encore ouvert
}

const STEPS = [
  { n: 1, label: "Créer le tournoi" },
  { n: 2, label: "Ouvrir les inscriptions" },
  { n: 3, label: "Inscriptions" },
  { n: 4, label: "Choisir le format" },
  { n: 6, label: "Lancer le tournoi" },
  { n: 7, label: "Résultats" },
  { n: 8, label: "Podium" },
];

export function BabyfootAdmin() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [gameDay, setGameDay] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/babyfoot/tournament", { credentials: "same-origin" })
      .then((r) => r.json()).then((d) => { if (!d.error) setState(d); else setMsg(d.error); })
      .catch(() => setMsg("Chargement impossible."));
  }, []);
  useEffect(load, [load]);

  const act = async (body: Record<string, unknown>, path = "tournament") => {
    setBusy(true); setMsg(null);
    const d = await post(body, path);
    if (d.error) setMsg(d.error);
    setBusy(false); load();
    return d;
  };

  if (!state) return <div className="px-4 py-8 max-w-2xl mx-auto text-canal-gray-muted">{msg ?? "Chargement…"}</div>;
  const { tournament: t, entries, matches, projection, availableTeams, awards, health } = state;
  const step = currentStep(t, matches);

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      {/* En-tête tournoi */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <h1 className="canal-headline text-2xl">🏓 Tournoi Baby-foot {t.season}</h1>
          <div className="flex items-center gap-2">
            {matches.length > 0 && (
              <button onClick={() => setGameDay((v) => !v)} className={`text-xs font-black rounded-lg px-2.5 py-1.5 ${gameDay ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-white border border-canal-yellow/40"}`}>
                ⚡ Jour J
              </button>
            )}
            <Link href="/admin/babyfoot/qr" className="text-xs font-black rounded-lg px-2.5 py-1.5 bg-canal-gray-mid text-white border border-canal-yellow/40 flex items-center gap-1">
              <QrCode size={13} /> QR
            </Link>
          </div>
        </div>
        <p className="text-canal-gray-muted text-sm mt-1">
          📅 {t.event_date ? new Date(t.event_date + "T00:00:00+11:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "date à définir"}
        </p>
      </div>

      {msg && <p className="text-red-400 text-sm font-bold">{msg}</p>}

      {gameDay ? (
        <GameDay state={state} busy={busy} act={act} onExit={() => setGameDay(false)} />
      ) : (<>

      {/* Stepper */}
      <div className="canal-card">
        <div className="space-y-2">
          {STEPS.map((s) => {
            const done = step > s.n;
            const current = step === s.n || (s.n === 4 && step === 4);
            return (
              <div key={s.n} className={`flex items-center gap-2 text-sm ${current ? "text-white font-bold" : done ? "text-canal-gray-muted" : "text-canal-gray-muted/60"}`}>
                {done ? <CheckCircle2 size={16} className="text-green-400 shrink-0" /> : current ? <Circle size={16} className="text-canal-yellow shrink-0 fill-canal-yellow/20" /> : <Circle size={16} className="shrink-0" />}
                {s.label}
                {s.n === 3 && <span className="text-canal-gray-muted font-normal">— {entries.length}/{t.target_teams}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tableau de bord (dès que le tournoi tourne) */}
      {matches.length > 0 && <Dashboard state={state} />}

      {/* Panneau de l'étape courante */}
      {step === 2 && (
        <StepCard title="Prêt à lancer les inscriptions ?" hint="Les binômes pourront s'inscrire via le QR / la page tournoi.">
          <button disabled={busy} onClick={() => act({ action: "open_registration" })} className={btnPrimary}>
            🟢 Ouvrir les inscriptions
          </button>
        </StepCard>
      )}

      {step === 3 && (
        <StepCard
          title="Inscriptions ouvertes"
          hint={`${entries.length} binôme${entries.length > 1 ? "s" : ""} inscrit${entries.length > 1 ? "s" : ""}${t.target_teams > entries.length ? ` · encore ${t.target_teams - entries.length} place${t.target_teams - entries.length > 1 ? "s" : ""}` : ""}`}
        >
          <BinomesManager entries={entries} availableTeams={availableTeams} busy={busy} act={act} />
          <HealthCard health={health} />
          <AvailabilityPanel entries={entries} />
          <button disabled={busy || entries.length < 2} onClick={() => { if (confirm("Fermer les inscriptions et passer au format ?")) act({ action: "close_registration" }); }} className={`${btnPrimary} mt-4`}>
            🔒 Fermer les inscriptions
          </button>
          {entries.length < 2 && <p className="text-xs text-canal-gray-muted mt-1">Au moins 2 binômes requis.</p>}
        </StepCard>
      )}

      {step === 4 && (
        <StepCard title="🎲 Le championnat est prêt" hint="Chaque binôme jouera 3 matchs. Un dernier coup d'œil, puis on génère.">
          <HealthCard health={health} />
          <AvailabilityPanel entries={entries} showBestSlot />
          <ChampionshipPlan projection={projection} busy={busy} act={act} />
        </StepCard>
      )}

      {step === 6 && (
        <StepCard title="Le tirage est prêt 🎲" hint="Vérifie le programme, puis lance le tournoi (visible TV + joueurs).">
          <RotationsPreview matches={matches} />
          <div className="flex gap-2 mt-3">
            <button disabled={busy} onClick={() => act({ action: "publish" })} className={btnPrimary}>🚀 Lancer le tournoi</button>
            <button disabled={busy} onClick={() => { if (confirm("Regénérer le championnat ? (efface le tirage actuel)")) act({ action: "generate" }); }} className={btnGhost}>Regénérer</button>
          </div>
        </StepCard>
      )}

      {step === 7 && (
        <ResultsPanel state={state} busy={busy} act={act} />
      )}

      {step === 8 && (
        <StepCard title="🏆 Tournoi terminé !" hint="Le podium est affiché sur la TV et le hub.">
          <Podium entries={entries} />
        </StepCard>
      )}

      {/* Outils avancés (repliés) */}
      <div>
        <button onClick={() => setShowTools((v) => !v)} className="flex items-center gap-1.5 text-xs text-canal-gray-muted">
          <Settings size={13} /> Outils avancés <ChevronDown size={13} className={showTools ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
        {showTools && (
          <div className="mt-2 space-y-3">
            {/* Historique des points (déplacé ici : inutile pendant le jeu) */}
            {awards.length > 0 && (
              <div className="canal-card">
                <h3 className="text-sm font-bold uppercase text-canal-yellow mb-2">Historique des points</h3>
                {[...awards].sort((a, b) => b.points - a.points).map((a) => {
                  const e = entries.find((x) => x.id === a.entry_id);
                  return (
                    <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem] gap-2 items-center text-sm border-b border-canal-gray-mid py-1">
                      <span className="text-white font-bold truncate">{e?.label ?? "—"}</span>
                      <span className="text-canal-gray-muted text-center truncate">{BABYFOOT.stageLabel[a.stage as BabyfootStage]}</span>
                      <span className="text-canal-yellow font-black text-right">+{a.points}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <ConfigCard t={t} busy={busy} onSave={(patch) => act({ action: "config", ...patch })} />
            <div className="canal-card flex flex-wrap gap-2 items-center">
              <span className="text-xs text-canal-gray-muted w-full">📱 QR « rejoindre une équipe » (afficher / partager) :</span>
              <Link href="/admin/babyfoot/qr" className={btnGhost}>Ouvrir le QR baby-foot</Link>
              <span className="text-xs text-canal-gray-muted w-full mt-1">🖨️ Affiches A3 (à imprimer, permanentes) :</span>
              <a href="/p/babyfoot/1" target="_blank" rel="noopener" className={btnGhost}>Affiche « Formez votre binôme »</a>
              <a href="/p/babyfoot/2" target="_blank" rel="noopener" className={btnGhost}>Affiche « Qui sera champion ? »</a>
            </div>
            <div className="canal-card flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => act({ action: "recompute" })} className={btnGhost}>↻ Recalculer les points</button>
              {step === 7 && <button disabled={busy} onClick={() => { if (confirm("Clôturer le tournoi (podium) ?")) act({ action: "status", status: "finished" }); }} className={btnGhost}>Clôturer → podium</button>}
              <button disabled={busy} onClick={() => { if (confirm("TOUT réinitialiser (matchs + points) et rouvrir les inscriptions ?")) act({ action: "reset" }); }} className="px-3 py-2 rounded-lg bg-red-900/40 text-red-300 text-sm">Réinitialiser</button>
            </div>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}

const btnPrimary = "w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-50 hover:bg-canal-yellow-hover transition-colors";
const btnGhost = "px-3 py-2 rounded-lg bg-canal-gray-mid text-white text-sm font-bold border border-canal-gray-light disabled:opacity-50";

// Santé du planning : contrôle AVANT le tirage (recalculé à chaque inscription).
function HealthCard({ health: h }: { health: PlanningHealth }) {
  const dot = (ok: boolean) => (ok ? "✅" : "⚠️");
  const fillColor: Record<string, string> = { green: "bg-green-500", orange: "bg-amber-500", red: "bg-red-500", closed: "bg-canal-gray-light" };
  const globalOk = h.ready;
  const globalBad = h.feasible === false || !h.even;
  return (
    <div className={`rounded-lg p-3 space-y-2 border ${globalOk ? "border-green-600/50 bg-green-900/10" : globalBad ? "border-red-600/50 bg-red-900/15" : "border-canal-yellow/40 bg-canal-yellow/5"}`}>
      <p className="text-xs font-bold uppercase text-canal-gray-muted">🩺 Santé du planning</p>
      <div className="space-y-1 text-sm">
        <p>{dot(h.teams >= 4 && h.even)} {h.teams} binômes inscrits{!h.even ? " — nombre IMPAIR (ajoute/retire un binôme)" : ""}</p>
        <p>{dot(h.allHaveMinSlots)} Chaque binôme a ≥ {h.minSlots} créneaux{!h.allHaveMinSlots ? ` — trop peu : ${h.lowSlotBinomes.join(", ")}` : ""}</p>
        <p>{h.feasible === null ? "⏳" : dot(h.feasible)} Planning {h.feasible === null ? "à vérifier (compléter les inscriptions)" : h.feasible ? `réalisable (${h.trialsOk}/${h.trials} tirages testés OK)` : "IMPOSSIBLE en l'état"}</p>
        {h.problemBinomes.length > 0 && (
          <p className="text-red-300">→ Demande plus de créneaux à : <b>{h.problemBinomes.join(", ")}</b></p>
        )}
      </div>
      <p className={`text-sm font-black ${globalOk ? "text-green-400" : globalBad ? "text-red-400" : "text-canal-yellow"}`}>
        {globalOk ? "✅ Prêt pour le tirage" : globalBad ? "❌ Corrige avant de générer" : "⏳ En attente d'inscriptions"}
      </p>
      {/* Jauges de remplissage des créneaux */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
        {h.slotFill.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-[10px]">
            <span className="w-20 text-canal-gray-muted shrink-0">{s.label}</span>
            <div className="flex-1 h-2 rounded-full bg-canal-gray-mid overflow-hidden"><div className={`h-2 ${fillColor[s.status]}`} style={{ width: `${Math.min(100, (s.count / s.cap) * 100)}%` }} /></div>
            <span className="w-8 text-right text-canal-gray-muted">{s.status === "closed" ? "plein" : `${s.count}/${s.cap}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Disponibilités EXPLOITÉES : histogramme par créneau + meilleur créneau conseillé.
function AvailabilityPanel({ entries, showBestSlot }: { entries: BabyfootEntryView[]; showBestSlot?: boolean }) {
  if (!entries.length) return null;
  const counts = BABYFOOT.slots.map((s) => ({ ...s, n: entries.filter((e) => e.availability.includes(s.key)).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  const best = counts.reduce((a, b) => (b.n > a.n ? b : a), counts[0]);
  return (
    <div className="rounded-lg bg-canal-gray-mid/40 p-3 space-y-1.5 mt-3">
      <p className="text-xs font-bold uppercase text-canal-gray-muted">Disponibilités des binômes</p>
      {counts.map((c) => (
        <div key={c.key} className="flex items-center gap-2 text-xs">
          <span className="w-24 text-white shrink-0">{c.label}</span>
          <div className="flex-1 bg-canal-gray-mid rounded-full h-3 overflow-hidden">
            <div className="bg-canal-yellow h-3 rounded-full transition-all" style={{ width: `${(c.n / max) * 100}%` }} />
          </div>
          <span className="w-5 text-right text-white font-bold shrink-0">{c.n}</span>
        </div>
      ))}
      {best.n > 0 && (
        <p className="text-[11px] text-canal-yellow pt-1">
          💡 {showBestSlot ? "Début conseillé : " : "Meilleur créneau : "}<b>{best.label}</b> ({best.n} binômes dispos).
        </p>
      )}
    </div>
  );
}

// MODE JOUR J : l'orga ne voit QUE le match en cours + de gros +/-. Après
// validation : flash « Victoire », le classement Top 4 se met à jour, et le
// match suivant s'affiche tout seul. Saisie en < 5 s, jamais de menu. On peut
// rouvrir un match terminé (depuis le programme) pour corriger un score.
const PHASE_WEIGHT: Record<string, number> = { league: 0, semi: 1, third: 2, final: 3 };
function hhmm(iso?: string | null): string { return iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Pacific/Noumea" }) : ""; }
// "Jeudi 16 · 11h30" — jour + créneau, à afficher sous le score.
function slotLabel(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", timeZone: "Pacific/Noumea" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Pacific/Noumea" }).replace(":", "h");
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}
const navBtn = "px-3 py-2 rounded-lg bg-canal-gray-mid text-white text-sm font-black border border-canal-gray-light disabled:opacity-30 active:scale-95";

function GameDay({ state, busy, act, onExit }: { state: State; busy: boolean; act: (b: Record<string, unknown>, path?: string) => void; onExit: () => void }) {
  const { matches, entries } = state;
  const labelByEntry = new Map(entries.map((e) => [e.id, e.label]));
  const lbl = (id?: string | null) => (id ? labelByEntry.get(id) ?? "?" : "à venir");

  const ordered = [...matches].sort((a, b) =>
    (PHASE_WEIGHT[a.phase ?? "league"] ?? 0) - (PHASE_WEIGHT[b.phase ?? "league"] ?? 0) ||
    (a.rotation ?? 99) - (b.rotation ?? 99) || (a.order_idx ?? 0) - (b.order_idx ?? 0));

  const [focusId, setFocusId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ winner: string; plural: boolean; sa: number; sb: number; pts: number | null; ptsLabel: string | null } | null>(null);

  const current = ordered.find((m) => m.status !== "finished" && m.entry_a_id && m.entry_b_id) ?? null;
  const shown = (focusId ? ordered.find((m) => m.id === focusId) : null) ?? current;
  const idx = shown ? ordered.findIndex((m) => m.id === shown.id) : -1;
  const prevNav = idx > 0 ? ordered[idx - 1] : null;
  const nextNav = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const browsing = !!shown && !!current && shown.id !== current.id;
  const upNext = current ? ordered.find((m) => m.id !== current.id && m.status !== "finished" && m.entry_a_id && m.entry_b_id) ?? null : null;

  const standings = computeChampionshipStandings(entries.map((e) => ({ id: e.id, team_id: e.team_id, forfeited: e.forfeited })), matches, BABYFOOT.qualifiers);
  const remaining = matches.filter((m) => m.status !== "finished").length;
  const finished = state.tournament.status === "finished";

  const submit = async (body: Record<string, unknown>) => {
    if (!body.clear && shown) {
      const sa = Number(body.score_a), sb = Number(body.score_b);
      const winner = sa > sb ? lbl(shown.entry_a_id) : lbl(shown.entry_b_id);
      const win = pointsForWin(shown.phase);
      setFlash({ winner, plural: winner.includes("&") || winner.includes(" et "), sa: Math.max(sa, sb), sb: Math.min(sa, sb), pts: win?.pts ?? null, ptsLabel: win?.label ?? null });
      setTimeout(() => setFlash(null), 2600);
    }
    setFocusId(null);
    await act(body, "result");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="canal-headline text-xl">⚡ Mode jour J</h2>
        <button onClick={onExit} className="text-xs text-canal-gray-muted underline">Quitter</button>
      </div>

      {flash && (
        <div className="rounded-2xl bg-green-500 text-canal-black text-center py-5 animate-[pop_0.4s_ease]">
          <p className="text-xs font-black uppercase tracking-wide">🏓 Match terminé</p>
          <p className="text-4xl font-black mt-1 tabular-nums">{flash.sa} – {flash.sb}</p>
          <p className="text-2xl font-black mt-1 px-3 leading-tight">{flash.winner} gagne{flash.plural ? "nt" : ""}</p>
          {flash.pts != null && <p className="text-base font-black mt-2 bg-canal-black/15 rounded-full inline-block px-4 py-1">+{flash.pts} {flash.ptsLabel}</p>}
        </div>
      )}

      {shown ? (<>
        <div className="flex items-center justify-between gap-2">
          <button disabled={!prevNav} onClick={() => prevNav && setFocusId(prevNav.id)} className={navBtn}>◀ Précédent</button>
          <span className="text-xs font-black text-canal-gray-muted">Match {idx + 1}/{ordered.length}{browsing ? " · aperçu" : ""}</span>
          <button disabled={!nextNav} onClick={() => nextNav && setFocusId(nextNav.id)} className={navBtn}>Suivant ▶</button>
        </div>
        <GameDayMatch key={shown.id} m={shown} labelA={lbl(shown.entry_a_id)} labelB={lbl(shown.entry_b_id)} busy={busy} onResult={submit} />
        {browsing && <button onClick={() => setFocusId(null)} className="w-full text-canal-yellow text-sm font-black">⤾ Revenir au match en cours</button>}
      </>) : !flash ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-canal-gray-muted text-lg">{remaining ? "En attente du prochain match…" : "🎉 Tournoi terminé !"}</p>
          {!remaining && finished && <button onClick={onExit} className={btnPrimary}>🏆 Voir le podium</button>}
        </div>
      ) : null}

      {upNext && !browsing && (
        <div className="rounded-xl bg-canal-gray-mid/40 p-3 text-center">
          <p className="text-[11px] uppercase font-bold text-canal-gray-muted">À suivre</p>
          <p className="text-white font-bold mt-0.5">{lbl(upNext.entry_a_id)} <span className="text-canal-gray-muted">vs</span> {lbl(upNext.entry_b_id)}</p>
        </div>
      )}

      <LiveStandings standings={standings} labelByEntry={labelByEntry} />
      <PlanningStrip ordered={ordered} shownId={shown?.id} lbl={lbl} onPick={setFocusId} />

      {remaining > 0 && <p className="text-center text-xs text-canal-gray-muted">{remaining} match{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""}</p>}
    </div>
  );
}

function GameDayMatch({ m, labelA, labelB, busy, onResult }: { m: BabyFootMatch; labelA: string; labelB: string; busy: boolean; onResult: (b: Record<string, unknown>) => void }) {
  const [a, setA] = useState<string>(m.score_a?.toString() ?? "");
  const [b, setB] = useState<string>(m.score_b?.toString() ?? "");
  const na = a === "" ? null : parseInt(a, 10);
  const nb = b === "" ? null : parseInt(b, 10);
  const tie = na != null && nb != null && na === nb;
  const ready = na != null && nb != null && na >= 0 && nb >= 0 && !tie;
  const leader = na != null && nb != null ? (na > nb ? labelA : labelB) : "";
  const plural = leader.includes("&") || leader.includes(" et ");
  const finished = m.status === "finished";
  const slot = slotLabel(m.starts_at);
  const inp = "w-full h-24 text-6xl text-center rounded-2xl bg-canal-gray-mid border-2 border-canal-gray-light focus:border-canal-yellow outline-none text-white font-black tabular-nums";
  // Score plafonné à 10 (le match se gagne à 10).
  const clean = (v: string) => { const n = v.replace(/[^0-9]/g, "").slice(0, 2); return n === "" ? "" : String(Math.min(10, parseInt(n, 10))); };
  return (
    <div className="canal-card border-2 border-canal-yellow/40 space-y-3">
      <div className="flex items-center justify-center gap-2 text-xs text-canal-gray-muted">
        {m.table_no != null ? <span className="font-black text-canal-black bg-canal-yellow rounded px-2 py-0.5">Table {m.table_no}</span> : null}
        <span className="uppercase font-bold">{m.round ?? PHASE_LABEL[m.phase ?? ""] ?? "Match"}</span>
        {finished && <span className="text-canal-yellow">· modifier résultat</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-center font-black text-white text-base leading-tight min-h-[2.5rem] flex items-center justify-center">{labelA}</p>
          <input value={a} onChange={(e) => setA(clean(e.target.value))} inputMode="numeric" pattern="[0-9]*" placeholder="0" className={inp} />
        </div>
        <div className="space-y-1.5">
          <p className="text-center font-black text-white text-base leading-tight min-h-[2.5rem] flex items-center justify-center">{labelB}</p>
          <input value={b} onChange={(e) => setB(clean(e.target.value))} inputMode="numeric" pattern="[0-9]*" placeholder="0" className={inp} />
        </div>
      </div>
      {slot && <p className="text-center text-sm font-bold text-canal-gray-muted">🕐 {slot}</p>}
      <button disabled={busy || !ready} onClick={() => onResult({ match_id: m.id, score_a: na, score_b: nb })} className={btnPrimary}>
        {tie ? "But en or : il faut un vainqueur" : ready ? `✅ Valider — ${leader} gagne${plural ? "nt" : ""}` : "✅ Valider le résultat"}
      </button>
      {finished && (
        <button disabled={busy} onClick={() => onResult({ match_id: m.id, clear: true })} className="w-full text-red-400 text-xs">↺ Annuler ce résultat</button>
      )}
    </div>
  );
}

// Classement LIVE affiché dans le mode jour J : chaque validation le met à jour,
// les joueurs voient tout de suite s'ils entrent dans le Top 4.
function LiveStandings({ standings, labelByEntry }: { standings: ChampStanding[]; labelByEntry: Map<string, string> }) {
  if (!standings.some((s) => s.played > 0)) return null;
  const cols = "grid grid-cols-[1.4rem_1fr_1.6rem_1.6rem_2.1rem_2.2rem] gap-1 items-center";
  return (
    <div className="canal-card">
      <p className="text-xs font-bold uppercase text-canal-yellow mb-2">🏆 Classement live · Top {BABYFOOT.qualifiers} qualifiés</p>
      <div className={`${cols} text-[10px] uppercase text-canal-gray-muted font-bold pb-1`}>
        <span /><span /><span className="text-right">MJ</span><span className="text-right">V</span><span className="text-right">Diff</span><span className="text-right">Pts</span>
      </div>
      {standings.map((s) => (
        <div key={s.entry_id}>
          <div className={`${cols} text-sm py-0.5 ${s.forfeited ? "text-canal-gray-muted" : s.qualified ? "text-green-300" : "text-white"}`}>
            <span className="font-black text-center">{s.forfeited ? "—" : s.rank}</span>
            <span className="font-bold truncate">{s.qualified ? "✓ " : ""}{labelByEntry.get(s.entry_id) ?? "?"}{s.forfeited ? " · forfait" : ""}</span>
            <span className="text-canal-gray-muted text-xs text-right">{s.played}</span>
            <span className="text-canal-gray-muted text-xs text-right">{s.won}</span>
            <span className="text-canal-gray-muted text-xs text-right">{s.gd > 0 ? `+${s.gd}` : s.gd}</span>
            <span className="font-black text-right tabular-nums">{s.won * 3}</span>
          </div>
          {s.rank === BABYFOOT.qualifiers && <div className="border-b-2 border-red-500/70 my-0.5" />}
        </div>
      ))}
    </div>
  );
}

// Programme : progression (✅ joué · ▶ en cours · ⏳ à venir). Cliquer un match
// TERMINÉ le rouvre pour corriger son score sans quitter le mode jour J.
function PlanningStrip({ ordered, shownId, lbl, onPick }: { ordered: BabyFootMatch[]; shownId?: string; lbl: (id?: string | null) => string; onPick: (id: string) => void }) {
  const done = ordered.filter((m) => m.status === "finished").length;
  return (
    <details className="canal-card">
      <summary className="text-xs font-bold uppercase text-canal-gray-muted cursor-pointer">🗓️ Programme — {done}/{ordered.length} joués</summary>
      <div className="mt-2 space-y-0.5">
        {ordered.map((m) => {
          const fin = m.status === "finished";
          const isCurrent = m.id === shownId;
          const icon = fin ? "✅" : isCurrent ? "▶" : "⏳";
          return (
            <button key={m.id} disabled={!fin} onClick={() => onPick(m.id)} className={`w-full flex items-center gap-2 text-xs py-1 text-left ${fin ? "text-canal-gray-muted hover:text-white" : isCurrent ? "text-canal-yellow font-black" : "text-white/80"}`}>
              <span className="w-14 shrink-0 tabular-nums">{m.starts_at ? hhmm(m.starts_at) : PHASE_LABEL[m.phase ?? ""] ?? ""}</span>
              <span className="w-4 text-center">{icon}</span>
              <span className="flex-1 truncate">{lbl(m.entry_a_id)} <b className="text-white">{fin ? `${m.score_a}–${m.score_b}` : "–"}</b> {lbl(m.entry_b_id)}</span>
            </button>
          );
        })}
      </div>
    </details>
  );
}

function StepCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="canal-card border border-canal-yellow/30 space-y-3">
      <div>
        <h2 className="font-black text-white">{title}</h2>
        {hint && <p className="text-xs text-canal-gray-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function BinomesManager({ entries, availableTeams, busy, act }: { entries: BabyfootEntryView[]; availableTeams: AvailableTeam[]; busy: boolean; act: (b: Record<string, unknown>) => void }) {
  const [pick, setPick] = useState("");
  return (
    <div className="space-y-3">
      {/* Ajout manuel d'un binôme */}
      <div className="flex gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1 px-2 py-2 rounded-lg bg-canal-gray-mid border border-canal-gray-light text-white text-sm">
          <option value="">+ Ajouter un binôme…</option>
          {availableTeams.map((tm) => (
            <option key={tm.id} value={tm.id}>{tm.members.length ? tm.members.join(" & ") : tm.name}</option>
          ))}
        </select>
        <button disabled={busy || !pick} onClick={() => { act({ action: "add_entry", team_id: pick }); setPick(""); }} className="px-3 rounded-lg bg-canal-yellow text-canal-black font-black text-sm disabled:opacity-40 flex items-center gap-1"><Plus size={14} /></button>
      </div>
      {/* Liste des binômes inscrits */}
      <div className="divide-y divide-canal-gray-mid">
        {entries.map((e, i) => (
          <div key={e.id} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="text-canal-gray-muted w-5 text-center">{i + 1}</span>
            <span className="flex-1 font-bold text-white">🏓 {e.label}</span>
            {e.availability.length > 0 && <span className="text-[10px] text-canal-gray-muted">{e.availability.map((k) => BABYFOOT.slots.find((s) => s.key === k)?.label.split(" ")[0]).join("/")}</span>}
            <button disabled={busy} onClick={() => { if (confirm(`Retirer ${e.label} ?`)) act({ action: "delete_entry", entry_id: e.id }); }} className="text-red-400"><X size={14} /></button>
          </div>
        ))}
        {!entries.length && <p className="py-3 text-center text-canal-gray-muted text-sm">Aucun binôme pour l&apos;instant.</p>}
      </div>

      {/* Qui manque : binômes complets (2 joueurs) pas encore inscrits */}
      {availableTeams.length > 0 && (
        <div className="rounded-lg bg-canal-gray-mid/40 p-3">
          <p className="text-xs font-bold text-canal-gray-muted uppercase mb-1.5">Pas encore inscrits ({availableTeams.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {availableTeams.map((tm) => (
              <span key={tm.id} className="text-xs bg-canal-gray-mid text-white rounded-full px-2 py-1">
                {tm.members.length ? tm.members.join(" & ") : tm.name}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-canal-gray-muted mt-1.5">Relance-les de vive voix — ou ajoute-les directement ci-dessus.</p>
        </div>
      )}
    </div>
  );
}

function ChampionshipPlan({ projection: p, busy, act }: { projection: ChampionshipProjection; busy: boolean; act: (b: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-canal-gray-mid/60 p-4 text-center border border-canal-yellow/20">
        <p className="text-3xl font-black text-canal-yellow">{p.teams} binômes</p>
        <div className="mt-3 space-y-1 text-sm text-white">
          <p>✓ Chacun joue <b>3 matchs</b> (championnat) → <b>{p.leagueMatches} matchs</b></p>
          <p>✓ Top 4 → demies (1v4 / 2v3), petite finale, finale</p>
          <p>✓ ~{p.rotations} rotations · durée estimée <b className="text-canal-yellow">{p.durationLabel}</b></p>
        </div>
      </div>
      {!p.even && (
        <p className="text-sm text-red-300 bg-red-900/20 border border-red-700/40 rounded-lg p-2">
          ⚠️ Nombre de binômes <b>impair</b> ({p.teams}) : ajoute ou retire un binôme pour un nombre pair avant de générer.
        </p>
      )}
      <button disabled={busy || !p.even || p.teams < 4} onClick={() => act({ action: "generate" })} className={btnPrimary}>
        🎲 Générer le championnat
      </button>
    </div>
  );
}

function RotationsPreview({ matches }: { matches: BabyFootMatch[] }) {
  const league = matches.filter((m) => m.phase === "league");
  const rots = [...new Set(league.map((m) => m.rotation).filter((r): r is number => r != null))].sort((a, b) => a - b);
  if (!rots.length) return <p className="text-sm text-canal-gray-muted">{league.length} matchs de championnat générés.</p>;
  return (
    <div className="space-y-2">
      {rots.map((rot) => {
        const ms = league.filter((m) => m.rotation === rot);
        const when = slotLabel(ms[0]?.starts_at);
        return (
          <div key={rot} className="bg-canal-gray-mid rounded-lg p-2">
            <p className="text-[11px] font-black text-canal-yellow uppercase">Rotation {rot}{when ? ` · ${when}` : ""}</p>
            {ms.map((m) => (
              <p key={m.id} className="text-white text-xs">{m.table_no != null ? `T${m.table_no} · ` : ""}{m.team_a?.name} vs {m.team_b?.name}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Tableau de bord de l'orga pendant le tournoi : l'essentiel en un coup d'œil.
function Dashboard({ state }: { state: State }) {
  const { entries, matches } = state;
  const total = matches.length;
  const done = matches.filter((m) => m.status === "finished").length;
  const ordered = [...matches].sort((a, b) =>
    (PHASE_WEIGHT[a.phase ?? "league"] ?? 0) - (PHASE_WEIGHT[b.phase ?? "league"] ?? 0) ||
    (a.rotation ?? 99) - (b.rotation ?? 99) || (a.order_idx ?? 0) - (b.order_idx ?? 0));
  const nextM = ordered.find((m) => m.status !== "finished" && m.entry_a_id && m.entry_b_id);
  const nextWhen = nextM ? (slotLabel(nextM.starts_at) || PHASE_LABEL[nextM.phase ?? ""] || "Phase finale") : "—";
  const stat = (v: React.ReactNode, l: string) => (
    <div className="text-center">
      <p className="text-2xl font-black text-canal-yellow tabular-nums leading-none">{v}</p>
      <p className="text-[10px] uppercase text-canal-gray-muted font-bold mt-1">{l}</p>
    </div>
  );
  return (
    <div className="canal-card">
      <div className="grid grid-cols-4 gap-2">
        {stat(entries.length, "équipes")}
        {stat(total, "matchs")}
        {stat(`${done}/${total}`, "terminés")}
        {stat(total - done, "restants")}
      </div>
      <div className="mt-3 rounded-lg bg-canal-gray-mid/50 p-2 text-center">
        <p className="text-[10px] uppercase text-canal-gray-muted font-bold">Prochain match</p>
        <p className="text-white font-black">{done === total ? "Tournoi terminé 🎉" : `🕐 ${nextWhen}`}</p>
      </div>
    </div>
  );
}

function ResultsPanel({ state, busy, act }: { state: State; busy: boolean; act: (b: Record<string, unknown>, path?: string) => void }) {
  const { matches, entries } = state;
  const labelByEntry = new Map(entries.map((e) => [e.id, e.label]));
  const lbl = (id?: string | null, fallback?: string) => (id ? labelByEntry.get(id) ?? fallback ?? "?" : "à venir");
  const byPhase = PHASE_ORDER.map((ph) => ({ ph, list: matches.filter((m) => m.phase === ph).sort((a, b) => (a.rotation ?? 99) - (b.rotation ?? 99) || (a.order_idx ?? 0) - (b.order_idx ?? 0)) })).filter((g) => g.list.length);
  const leagueMatches = matches.filter((m) => m.phase === "league");
  const leagueDone = leagueMatches.length > 0 && leagueMatches.every((m) => m.status === "finished");
  const hasKo = matches.some((m) => m.phase && m.phase !== "league");
  const championDecided = matches.some((m) => m.phase === "final" && m.status === "finished");
  return (
    <StepCard title="Saisir les résultats" hint="Le match suivant se remplit tout seul dès qu'un vainqueur est validé.">
      {leagueDone && !hasKo && (
        <button disabled={busy} onClick={() => act({ action: "generate_ko" })} className={`${btnPrimary} mb-3`}>
          🏆 Générer la phase finale (Top 4 du championnat)
        </button>
      )}
      {championDecided && (
        <button disabled={busy} onClick={() => { if (confirm("Clôturer et afficher le podium ?")) act({ action: "status", status: "finished" }); }} className={`${btnPrimary} mb-3`}>
          🎉 Clôturer → Podium
        </button>
      )}
      <div className="space-y-4">
        {byPhase.map(({ ph, list }) => (
          <div key={ph}>
            <p className="text-xs font-bold uppercase text-canal-yellow mb-1.5">{PHASE_LABEL[ph]}</p>
            <div className="space-y-2">
              {list.map((m) => <MatchRow key={m.id} m={m} labelA={lbl(m.entry_a_id, m.team_a?.name)} labelB={lbl(m.entry_b_id, m.team_b?.name)} busy={busy} onResult={(b) => act(b, "result")} />)}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-canal-gray-muted mt-2">{entries.length} binômes engagés.</p>
    </StepCard>
  );
}

function Podium({ entries }: { entries: BabyfootEntryView[] }) {
  const medal = ["🥇", "🥈", "🥉"];
  const top = entries.filter((e) => e.final_rank && e.final_rank <= 3).sort((a, b) => (a.final_rank ?? 9) - (b.final_rank ?? 9));
  if (!top.length) return <p className="text-sm text-canal-gray-muted">Podium en attente de la finale.</p>;
  return (
    <div className="space-y-2">
      {top.map((e) => <div key={e.id} className="flex items-center gap-3"><span className="text-2xl">{medal[(e.final_rank ?? 1) - 1]}</span><span className="font-black text-white">{e.label}</span></div>)}
    </div>
  );
}

function ConfigCard({ t, busy, onSave }: { t: BabyfootTournament; busy: boolean; onSave: (p: Record<string, unknown>) => void }) {
  const [tables, setTables] = useState(t.tables_count);
  const [poolT, setPoolT] = useState(t.pool_target);
  const [koT, setKoT] = useState(t.ko_target);
  const [finalT, setFinalT] = useState(t.final_target);
  const [target, setTarget] = useState(t.target_teams);
  const num = "w-16 px-2 py-1 rounded bg-canal-gray-mid border border-canal-gray-light text-white text-sm text-center";
  return (
    <div className="canal-card space-y-3">
      <h3 className="text-sm font-bold uppercase text-canal-yellow">Réglages</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="flex items-center justify-between">Tables <input type="number" min={1} max={4} value={tables} onChange={(e) => setTables(+e.target.value)} className={num} /></label>
        <label className="flex items-center justify-between">Objectif équipes <input type="number" min={2} value={target} onChange={(e) => setTarget(+e.target.value)} className={num} /></label>
        <label className="flex items-center justify-between">Score poule <input type="number" min={1} value={poolT} onChange={(e) => setPoolT(+e.target.value)} className={num} /></label>
        <label className="flex items-center justify-between">Score élim. <input type="number" min={1} value={koT} onChange={(e) => setKoT(+e.target.value)} className={num} /></label>
        <label className="flex items-center justify-between">Score finale <input type="number" min={1} value={finalT} onChange={(e) => setFinalT(+e.target.value)} className={num} /></label>
      </div>
      <button disabled={busy} onClick={() => onSave({ tables_count: tables, pool_target: poolT, ko_target: koT, final_target: finalT, target_teams: target })} className={btnGhost}>Enregistrer</button>
    </div>
  );
}

function MatchRow({ m, labelA, labelB, busy, onResult }: { m: BabyFootMatch; labelA: string; labelB: string; busy: boolean; onResult: (b: Record<string, unknown>) => void }) {
  const [a, setA] = useState<string>(m.score_a?.toString() ?? "");
  const [b, setB] = useState<string>(m.score_b?.toString() ?? "");
  const finished = m.status === "finished";
  const ready = !!m.entry_a_id && !!m.entry_b_id;
  const nameA = labelA;
  const nameB = labelB;
  return (
    <div className={`canal-card flex items-center gap-2 py-2 ${finished ? "opacity-80" : ""}`}>
      {m.table_no != null && <span className="text-[10px] font-black text-canal-black bg-canal-yellow rounded px-1 w-5 text-center">T{m.table_no}</span>}
      <span className="flex-1 text-sm font-bold text-right truncate text-white">{nameA}</span>
      <input value={a} onChange={(e) => setA(e.target.value)} disabled={!ready} inputMode="numeric" className="w-9 px-1 py-1 rounded bg-canal-gray-mid border border-canal-gray-light text-white text-center text-sm" />
      <span className="text-canal-gray-muted">-</span>
      <input value={b} onChange={(e) => setB(e.target.value)} disabled={!ready} inputMode="numeric" className="w-9 px-1 py-1 rounded bg-canal-gray-mid border border-canal-gray-light text-white text-center text-sm" />
      <span className="flex-1 text-sm font-bold truncate text-white">{nameB}</span>
      <button disabled={busy || !ready} onClick={() => onResult({ match_id: m.id, score_a: +a, score_b: +b })} className="px-2 py-1 rounded bg-canal-yellow text-canal-black text-xs font-black disabled:opacity-40">OK</button>
      {finished && <button disabled={busy} onClick={() => onResult({ match_id: m.id, clear: true })} className="text-red-400 text-xs">↺</button>}
    </div>
  );
}
