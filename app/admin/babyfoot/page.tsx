"use client";

// /admin/babyfoot — ASSISTANT pas-à-pas d'organisation du tournoi (pas un CRUD).
// L'orga est guidé : créer → ouvrir inscriptions → gérer les binômes → fermer →
// choisir le format → générer → lancer → saisir les résultats → podium.
// Les matchs sont une CONSÉQUENCE de la génération, jamais créés à la main.
// Protégé par app/admin/layout.tsx (requireRole event_admin).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BABYFOOT, type BabyfootStage } from "@/lib/config/babyfoot";
import type { BabyfootTournament, BabyFootMatch, BabyfootAward } from "@/lib/supabase/types";
import type { BabyfootEntryView } from "@/lib/data/babyfoot";
import type { BothProjections } from "@/lib/babyfoot/format";
import { CheckCircle2, Circle, Loader2, Plus, X, Trophy, Settings, ChevronDown } from "lucide-react";

interface AvailableTeam { id: string; name: string; members: string[]; }
interface State {
  tournament: BabyfootTournament;
  entries: BabyfootEntryView[];
  matches: BabyFootMatch[];
  awards: BabyfootAward[];
  projection: BothProjections;
  availableTeams: AvailableTeam[];
}

const PHASE_ORDER = ["pool", "prelim", "quarter", "semi", "final", "third"];
const PHASE_LABEL: Record<string, string> = { pool: "Poules", prelim: "Barrages", quarter: "Quarts", semi: "Demi-finales", final: "Finale", third: "Petite finale" };

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

export default function AdminBabyfootPage() {
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
  const { tournament: t, entries, matches, projection, availableTeams, awards } = state;
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
            <Link href="/babyfoot" className="text-xs text-canal-yellow underline">Joueur →</Link>
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
          <AvailabilityPanel entries={entries} />
          <button disabled={busy || entries.length < 2} onClick={() => { if (confirm("Fermer les inscriptions et passer au format ?")) act({ action: "close_registration" }); }} className={`${btnPrimary} mt-4`}>
            🔒 Fermer les inscriptions
          </button>
          {entries.length < 2 && <p className="text-xs text-canal-gray-muted mt-1">Au moins 2 binômes requis.</p>}
        </StepCard>
      )}

      {step === 4 && (
        <StepCard title="🎲 Le tournoi est prêt" hint="Voici ce qui va se passer — un dernier coup d'œil, puis on lance.">
          <AvailabilityPanel entries={entries} showBestSlot />
          <FormatChooser t={t} projection={projection} busy={busy} act={act} entriesCount={entries.length} />
        </StepCard>
      )}

      {step === 6 && (
        <StepCard title="Le tirage est prêt 🎲" hint="Vérifie les poules, puis lance le tournoi (visible sur la TV et côté joueur).">
          <PoolsPreview matches={matches} entries={entries} />
          <div className="flex gap-2 mt-3">
            <button disabled={busy} onClick={() => act({ action: "publish" })} className={btnPrimary}>🚀 Lancer le tournoi</button>
            <button disabled={busy} onClick={() => { if (confirm("Regénérer le tableau ? (efface le tirage actuel)")) act({ action: "generate" }); }} className={btnGhost}>Regénérer</button>
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

      {/* Points attribués (visible dès qu'il y en a) */}
      {awards.length > 0 && step >= 7 && (
        <div className="canal-card">
          <h3 className="text-sm font-bold uppercase text-canal-yellow mb-2">Points attribués</h3>
          {[...awards].sort((a, b) => b.points - a.points).map((a) => {
            const e = entries.find((x) => x.id === a.entry_id);
            return (
              <div key={a.id} className="flex items-center justify-between text-sm border-b border-canal-gray-mid py-1">
                <span className="text-white font-bold">{e?.label ?? "—"}</span>
                <span className="text-canal-gray-muted">{BABYFOOT.stageLabel[a.stage as BabyfootStage]}</span>
                <span className="text-canal-yellow font-black">+{a.points}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Outils avancés (repliés) */}
      <div>
        <button onClick={() => setShowTools((v) => !v)} className="flex items-center gap-1.5 text-xs text-canal-gray-muted">
          <Settings size={13} /> Outils avancés <ChevronDown size={13} className={showTools ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
        {showTools && (
          <div className="mt-2 space-y-3">
            <ConfigCard t={t} busy={busy} onSave={(patch) => act({ action: "config", ...patch })} />
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

// MODE JOUR J : interface ultra-simplifiée. L'orga ne voit QUE le(s) match(s) à
// jouer + le score. Le match suivant apparaît tout seul, il ne choisit jamais
// les équipes.
function GameDay({ state, busy, act, onExit }: { state: State; busy: boolean; act: (b: Record<string, unknown>, path?: string) => void; onExit: () => void }) {
  const { matches, entries } = state;
  const labelByTeam = new Map(entries.map((e) => [e.team_id, e.label]));
  const lbl = (id?: string | null) => (id ? labelByTeam.get(id) ?? "?" : "à venir");
  const ready = matches.filter((m) => m.status !== "finished" && m.team_a_id && m.team_b_id).sort((a, b) => (a.table_no ?? 99) - (b.table_no ?? 99) || (a.order_idx ?? 0) - (b.order_idx ?? 0));
  const poolMatches = matches.filter((m) => m.phase === "pool");
  const poolsDone = poolMatches.length > 0 && poolMatches.every((m) => m.status === "finished");
  const hasKo = matches.some((m) => m.phase && m.phase !== "pool");
  const championDecided = matches.some((m) => m.phase === "final" && m.status === "finished");
  const remaining = matches.filter((m) => m.status !== "finished").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="canal-headline text-xl">⚡ Mode jour J</h2>
        <button onClick={onExit} className="text-xs text-canal-gray-muted underline">Quitter</button>
      </div>

      {poolsDone && !hasKo && (
        <button disabled={busy} onClick={() => act({ action: "generate_ko" })} className={btnPrimary}>🏆 Lancer la phase finale</button>
      )}
      {championDecided && (
        <button disabled={busy} onClick={() => { if (confirm("Fin du tournoi ?")) act({ action: "status", status: "finished" }); }} className={btnPrimary}>🎉 Fin du tournoi → Podium</button>
      )}

      {ready.length ? (
        ready.map((m) => <GameDayMatch key={m.id} m={m} labelA={lbl(m.team_a_id)} labelB={lbl(m.team_b_id)} busy={busy} onResult={(b) => act(b, "result")} />)
      ) : (
        <p className="text-center text-canal-gray-muted py-10 text-lg">{remaining ? "En attente du prochain match…" : "Tous les matchs sont joués 🎉"}</p>
      )}
      {remaining > 0 && <p className="text-center text-xs text-canal-gray-muted">{remaining} match{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""}</p>}
    </div>
  );
}

function GameDayMatch({ m, labelA, labelB, busy, onResult }: { m: BabyFootMatch; labelA: string; labelB: string; busy: boolean; onResult: (b: Record<string, unknown>) => void }) {
  const [a, setA] = useState<string>(m.score_a?.toString() ?? "");
  const [b, setB] = useState<string>(m.score_b?.toString() ?? "");
  const finished = m.status === "finished";
  const inp = "w-16 h-16 text-3xl text-center rounded-xl bg-canal-gray-mid border-2 border-canal-gray-light text-white font-black";
  return (
    <div className="canal-card border border-canal-yellow/30 space-y-3">
      <div className="flex items-center justify-center gap-2 text-xs text-canal-gray-muted">
        {m.table_no != null ? <span className="font-black text-canal-black bg-canal-yellow rounded px-2 py-0.5">Table {m.table_no}</span> : null}
        <span>{m.round ?? m.phase}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex-1 text-right font-black text-white text-lg leading-tight">{labelA}</span>
        <input value={a} onChange={(e) => setA(e.target.value)} inputMode="numeric" className={inp} />
        <span className="text-canal-gray-muted">-</span>
        <input value={b} onChange={(e) => setB(e.target.value)} inputMode="numeric" className={inp} />
        <span className="flex-1 font-black text-white text-lg leading-tight">{labelB}</span>
      </div>
      <button disabled={busy || a === "" || b === ""} onClick={() => onResult({ match_id: m.id, score_a: +a, score_b: +b })} className={btnPrimary}>
        ✅ Valider le score
      </button>
      {finished && <button disabled={busy} onClick={() => onResult({ match_id: m.id, clear: true })} className="w-full text-red-400 text-xs">↺ Annuler</button>}
    </div>
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

function FormatChooser({ t, projection, busy, act, entriesCount }: { t: BabyfootTournament; projection: BothProjections; busy: boolean; act: (b: Record<string, unknown>) => void; entriesCount: number }) {
  const chosen = t.format;
  const p = chosen === "ko" ? projection.ko : projection.poolsKo;
  const poolLabel = (pools: number[]) => {
    if (!pools.length) return "";
    const uniq = [...new Set(pools)];
    return uniq.length === 1 ? `de ${uniq[0]}` : `(${pools.join("/")})`;
  };
  const chip = (on: boolean) => `px-2.5 py-1 rounded-full text-xs font-bold border ${on ? "bg-canal-yellow text-canal-black border-canal-yellow" : "bg-canal-gray-mid text-canal-gray-muted border-canal-gray-light"}`;
  return (
    <div className="space-y-4">
      {/* Le plan, en clair */}
      <div className="rounded-xl bg-canal-gray-mid/60 p-4 text-center border border-canal-yellow/20">
        <p className="text-3xl font-black text-canal-yellow">{entriesCount} binômes</p>
        <div className="mt-3 space-y-1 text-sm text-white">
          {p.pools.length > 0 && <p>✓ {p.pools.length} poules {poolLabel(p.pools)}</p>}
          <p>✓ {p.totalMatches} matchs</p>
          <p>✓ durée estimée <b className="text-canal-yellow">{p.durationTwoTablesLabel}</b> à 2 tables · {p.durationOneTableLabel} à 1 table</p>
        </div>
      </div>
      {/* Format en second plan */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-canal-gray-muted">Format :</span>
        {(["pools_ko", "ko"] as const).map((f) => (
          <button key={f} disabled={busy} onClick={() => act({ action: "config", format: f })} className={chip(chosen === f)}>
            {f === "ko" ? "Élim. directe" : "Poules + élim."}{projection.recommended === f ? " 💡" : ""}
          </button>
        ))}
      </div>
      <button disabled={busy || entriesCount < 2} onClick={() => act({ action: "generate" })} className={btnPrimary}>
        🎲 Générer le tournoi
      </button>
    </div>
  );
}

function PoolsPreview({ matches, entries }: { matches: BabyFootMatch[]; entries: BabyfootEntryView[] }) {
  const byPool = new Map<string, string[]>();
  for (const e of entries) if (e.pool_label) { if (!byPool.has(e.pool_label)) byPool.set(e.pool_label, []); byPool.get(e.pool_label)!.push(e.label); }
  if (byPool.size === 0) {
    return <p className="text-sm text-canal-gray-muted">{matches.length} matchs générés (élimination directe).</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {[...byPool.entries()].sort().map(([p, list]) => (
        <div key={p} className="bg-canal-gray-mid rounded-lg p-2">
          <p className="font-black text-canal-yellow text-sm">Poule {p}</p>
          {list.map((l) => <p key={l} className="text-white text-xs">{l}</p>)}
        </div>
      ))}
    </div>
  );
}

function ResultsPanel({ state, busy, act }: { state: State; busy: boolean; act: (b: Record<string, unknown>, path?: string) => void }) {
  const { matches, entries } = state;
  const labelByTeam = new Map(entries.map((e) => [e.team_id, e.label]));
  const lbl = (id?: string | null, fallback?: string) => (id ? labelByTeam.get(id) ?? fallback ?? "?" : "à venir");
  const byPhase = PHASE_ORDER.map((ph) => ({ ph, list: matches.filter((m) => m.phase === ph) })).filter((g) => g.list.length);
  const poolMatches = matches.filter((m) => m.phase === "pool");
  const poolsDone = poolMatches.length > 0 && poolMatches.every((m) => m.status === "finished");
  const hasKo = matches.some((m) => m.phase && m.phase !== "pool");
  const championDecided = matches.some((m) => m.phase === "final" && m.status === "finished");
  return (
    <StepCard title="Saisir les résultats" hint="Le match suivant se remplit tout seul dès qu'un vainqueur est validé.">
      {poolsDone && !hasKo && (
        <button disabled={busy} onClick={() => act({ action: "generate_ko" })} className={`${btnPrimary} mb-3`}>
          🏆 Générer la phase finale (qualifiés des poules)
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
              {list.map((m) => <MatchRow key={m.id} m={m} labelA={lbl(m.team_a_id, m.team_a?.name)} labelB={lbl(m.team_b_id, m.team_b?.name)} busy={busy} onResult={(b) => act(b, "result")} />)}
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
  const ready = !!m.team_a_id && !!m.team_b_id;
  const nameA = labelA;
  const nameB = labelB;
  return (
    <div className={`canal-card flex items-center gap-2 py-2 ${finished ? "opacity-80" : ""}`}>
      {m.pool_label && <span className="text-[10px] font-black text-canal-yellow w-4">{m.pool_label}</span>}
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
