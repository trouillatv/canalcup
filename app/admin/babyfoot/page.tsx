"use client";

// /admin/babyfoot — pilotage complet du Tournoi Baby-foot (édition active).
// Protégé par app/admin/layout.tsx (requireRole event_admin). Les appels API
// passent par la session cookie (isAdminRequest) — aucun secret côté client.
//
// Sections : statut/cérémonial · config (format, scores, dates) · inscriptions
// (toggle + matrice dispos + suppression) · projection des 2 formats · génération
// & publication · saisie des résultats · points attribués.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BABYFOOT, type BabyfootStage } from "@/lib/config/babyfoot";
import type { BabyfootTournament, BabyFootMatch, BabyfootAward } from "@/lib/supabase/types";
import type { BabyfootEntryView } from "@/lib/data/babyfoot";
import type { BothProjections } from "@/lib/babyfoot/format";

interface State {
  tournament: BabyfootTournament;
  entries: BabyfootEntryView[];
  matches: BabyFootMatch[];
  awards: BabyfootAward[];
  projection: BothProjections;
}

const STATUS_FLOW: { key: string; label: string }[] = [
  { key: "draft", label: "Brouillon" },
  { key: "registration", label: "Inscriptions" },
  { key: "draw", label: "Tirage" },
  { key: "pools", label: "Poules" },
  { key: "knockout", label: "Phase finale" },
  { key: "finished", label: "Terminé" },
];

const PHASE_ORDER = ["pool", "prelim", "quarter", "semi", "final", "third"];
const PHASE_LABEL: Record<string, string> = {
  pool: "Poules", prelim: "Barrages", quarter: "Quarts", semi: "Demi-finales", final: "Finale", third: "Petite finale",
};

async function post(body: Record<string, unknown>, path = "tournament") {
  const res = await fetch(`/api/admin/babyfoot/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

export default function AdminBabyfootPage() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/babyfoot/tournament", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => { if (!d.error) setState(d); else setMsg(d.error); })
      .catch(() => setMsg("Chargement impossible."));
  }, []);
  useEffect(load, [load]);

  const act = async (body: Record<string, unknown>, path = "tournament") => {
    setBusy(true); setMsg(null);
    const d = await post(body, path);
    if (d.error) setMsg(d.error);
    setBusy(false);
    load();
    return d;
  };

  if (!state) {
    return <div className="px-4 py-8 max-w-3xl mx-auto text-canal-gray-muted">{msg ?? "Chargement…"}</div>;
  }
  const { tournament: t, entries, matches, awards, projection } = state;

  const matchesByPhase = PHASE_ORDER
    .map((ph) => ({ ph, list: matches.filter((m) => m.phase === ph) }))
    .filter((g) => g.list.length);

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="canal-headline text-2xl">🎮 Admin Baby-foot</h1>
        <Link href="/babyfoot" className="text-xs text-canal-yellow underline">Voir côté joueur →</Link>
      </div>
      <p className="text-canal-gray-muted text-sm -mt-4">
        {t.name} · saison {t.season} · {entries.length} binôme{entries.length > 1 ? "s" : ""} inscrit{entries.length > 1 ? "s" : ""}
      </p>

      {msg && <p className="text-red-400 text-sm font-bold">{msg}</p>}

      {/* ── Cérémonial / statut ─────────────────────────────────────────── */}
      <section className="canal-card space-y-3">
        <h2 className="text-sm font-bold uppercase text-canal-yellow">Étape en cours</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_FLOW.map((s) => (
            <button
              key={s.key}
              disabled={busy}
              onClick={() => act({ action: "status", status: s.key })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                t.status === s.key
                  ? "bg-canal-yellow text-canal-black border-canal-yellow"
                  : "bg-canal-gray-mid text-white border-canal-gray-light hover:border-canal-yellow/50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-canal-gray-muted">
          Le statut pilote les écrans TV (inscriptions → tirage → poules → phase finale → remise des prix).
        </p>
      </section>

      {/* ── Inscriptions ────────────────────────────────────────────────── */}
      <section className="canal-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase text-canal-yellow">Inscriptions</h2>
          <button
            disabled={busy}
            onClick={() => act({ action: "registration", open: !t.registration_open })}
            className={`px-3 py-1.5 rounded-lg text-xs font-black ${t.registration_open ? "bg-green-600 text-white" : "bg-canal-gray-mid text-canal-gray-muted"}`}
          >
            {t.registration_open ? "Ouvertes ✓ (fermer)" : "Fermées (ouvrir)"}
          </button>
        </div>

        {/* Matrice binôme × créneaux */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-canal-gray-muted border-b border-canal-gray-light">
                <th className="text-left py-1.5 pr-2">Binôme</th>
                <th className="py-1.5 px-1 text-center">Poule</th>
                {BABYFOOT.slots.map((s) => <th key={s.key} className="py-1.5 px-1 text-center">{s.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-canal-gray-mid">
                  <td className="py-1.5 pr-2 font-bold text-white">{e.label}</td>
                  <td className="text-center text-canal-yellow font-bold">{e.pool_label ?? "—"}</td>
                  {BABYFOOT.slots.map((s) => (
                    <td key={s.key} className="text-center">
                      {e.availability.includes(s.key) ? <span className="text-green-400">✓</span> : <span className="text-canal-gray-muted">·</span>}
                    </td>
                  ))}
                  <td className="text-right">
                    <button
                      disabled={busy}
                      onClick={() => { if (confirm(`Supprimer ${e.label} ?`)) act({ action: "delete_entry", entry_id: e.id }); }}
                      className="text-red-400 text-xs hover:underline"
                    >✕</button>
                  </td>
                </tr>
              ))}
              {!entries.length && <tr><td colSpan={3 + BABYFOOT.slots.length} className="py-3 text-center text-canal-gray-muted">Aucun binôme inscrit.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Configuration ───────────────────────────────────────────────── */}
      <ConfigCard t={t} busy={busy} onSave={(patch) => act({ action: "config", ...patch })} />

      {/* ── Projection & génération ─────────────────────────────────────── */}
      <section className="canal-card space-y-4">
        <h2 className="text-sm font-bold uppercase text-canal-yellow">Format & durée estimée ({entries.length} binômes)</h2>
        <div className="grid grid-cols-2 gap-3">
          {(["ko", "poolsKo"] as const).map((k) => {
            const p = k === "ko" ? projection.ko : projection.poolsKo;
            const fmt = k === "ko" ? "ko" : "pools_ko";
            const isReco = projection.recommended === fmt;
            const isChosen = t.format === fmt;
            return (
              <button
                key={k}
                disabled={busy}
                onClick={() => act({ action: "config", format: fmt })}
                className={`text-left p-3 rounded-xl border transition-colors ${isChosen ? "border-canal-yellow bg-canal-yellow/10" : "border-canal-gray-light bg-canal-gray-mid"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-white text-sm">{k === "ko" ? "Élimination directe" : "Poules + élim."}</span>
                  {isReco && <span className="text-[9px] font-black text-canal-black bg-canal-yellow px-1.5 py-0.5 rounded">💡 RECO</span>}
                </div>
                <p className="text-xs text-canal-gray-muted mt-1">{p.totalMatches} matchs{p.pools.length ? ` · ${p.pools.length} poules` : ""}</p>
                <p className="text-[11px] text-canal-gray-muted mt-1">1 table : <span className="text-white font-bold">{p.durationOneTableLabel}</span></p>
                <p className="text-[11px] text-canal-gray-muted">2 tables : <span className="text-white font-bold">{p.durationTwoTablesLabel}</span></p>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-canal-gray-muted">{projection.reason}</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy || entries.length < 2} onClick={() => { if (confirm("Générer le tableau ? (efface les matchs existants)")) act({ action: "generate" }); }}
            className="px-3 py-2 rounded-lg bg-canal-yellow text-canal-black font-black text-sm disabled:opacity-50">
            ⚙️ Générer le tableau
          </button>
          {matches.some((m) => m.phase === "pool") && (
            <button disabled={busy} onClick={() => { if (confirm("Générer la phase finale depuis les qualifiés des poules ?")) act({ action: "generate_ko" }); }}
              className="px-3 py-2 rounded-lg bg-canal-gray-mid text-white font-bold text-sm border border-canal-yellow/40">
              🏆 Générer la phase finale
            </button>
          )}
          <button disabled={busy || !matches.length} onClick={() => act({ action: "publish" })}
            className="px-3 py-2 rounded-lg bg-green-700 text-white font-bold text-sm disabled:opacity-50">
            📢 Publier
          </button>
          <button disabled={busy} onClick={() => act({ action: "recompute" })}
            className="px-3 py-2 rounded-lg bg-canal-gray-mid text-canal-gray-muted text-sm">↻ Recalculer points</button>
          <button disabled={busy} onClick={() => { if (confirm("Tout réinitialiser (matchs + points) ?")) act({ action: "reset" }); }}
            className="px-3 py-2 rounded-lg bg-red-900/40 text-red-300 text-sm">Réinitialiser</button>
        </div>
      </section>

      {/* ── Matchs & saisie ─────────────────────────────────────────────── */}
      {matchesByPhase.map(({ ph, list }) => (
        <section key={ph} className="space-y-2">
          <h2 className="text-sm font-bold uppercase text-canal-yellow">{PHASE_LABEL[ph]}</h2>
          <div className="space-y-2">
            {list.map((m) => <MatchRow key={m.id} m={m} busy={busy} onResult={(b) => act(b, "result")} onTable={(no) => act({ action: "set_table", match_id: m.id, table_no: no })} />)}
          </div>
        </section>
      ))}

      {/* ── Points attribués ────────────────────────────────────────────── */}
      {awards.length > 0 && (
        <section className="canal-card space-y-2">
          <h2 className="text-sm font-bold uppercase text-canal-yellow">Points attribués</h2>
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
        </section>
      )}
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
    <section className="canal-card space-y-3">
      <h2 className="text-sm font-bold uppercase text-canal-yellow">Réglages</h2>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="flex items-center justify-between">Tables <input type="number" min={1} max={4} value={tables} onChange={(e) => setTables(+e.target.value)} className={num} /></label>
        <label className="flex items-center justify-between">Objectif équipes <input type="number" min={2} value={target} onChange={(e) => setTarget(+e.target.value)} className={num} /></label>
        <label className="flex items-center justify-between">Score poule <input type="number" min={1} value={poolT} onChange={(e) => setPoolT(+e.target.value)} className={num} /></label>
        <label className="flex items-center justify-between">Score élim. <input type="number" min={1} value={koT} onChange={(e) => setKoT(+e.target.value)} className={num} /></label>
        <label className="flex items-center justify-between">Score finale <input type="number" min={1} value={finalT} onChange={(e) => setFinalT(+e.target.value)} className={num} /></label>
      </div>
      <button disabled={busy} onClick={() => onSave({ tables_count: tables, pool_target: poolT, ko_target: koT, final_target: finalT, target_teams: target })}
        className="px-3 py-1.5 rounded-lg bg-canal-gray-mid text-white text-sm font-bold border border-canal-gray-light">Enregistrer les réglages</button>
    </section>
  );
}

function MatchRow({ m, busy, onResult, onTable }: {
  m: BabyFootMatch; busy: boolean;
  onResult: (b: Record<string, unknown>) => void;
  onTable: (n: number | null) => void;
}) {
  const [a, setA] = useState<string>(m.score_a?.toString() ?? "");
  const [b, setB] = useState<string>(m.score_b?.toString() ?? "");
  const finished = m.status === "finished";
  const nameA = m.team_a?.name ?? (m.team_a_id ? "?" : "à venir");
  const nameB = m.team_b?.name ?? (m.team_b_id ? "?" : "à venir");
  const ready = !!m.team_a_id && !!m.team_b_id;
  return (
    <div className={`canal-card flex items-center gap-2 ${finished ? "opacity-80" : ""}`}>
      {m.pool_label && <span className="text-[10px] font-black text-canal-yellow w-5">{m.pool_label}</span>}
      <span className="flex-1 text-sm font-bold text-right truncate text-white">{nameA}</span>
      <input value={a} onChange={(e) => setA(e.target.value)} disabled={!ready} inputMode="numeric"
        className="w-9 px-1 py-1 rounded bg-canal-gray-mid border border-canal-gray-light text-white text-center text-sm" />
      <span className="text-canal-gray-muted">-</span>
      <input value={b} onChange={(e) => setB(e.target.value)} disabled={!ready} inputMode="numeric"
        className="w-9 px-1 py-1 rounded bg-canal-gray-mid border border-canal-gray-light text-white text-center text-sm" />
      <span className="flex-1 text-sm font-bold truncate text-white">{nameB}</span>
      <button disabled={busy || !ready} onClick={() => onResult({ match_id: m.id, score_a: +a, score_b: +b })}
        className="px-2 py-1 rounded bg-canal-yellow text-canal-black text-xs font-black disabled:opacity-40">OK</button>
      {finished && <button disabled={busy} onClick={() => onResult({ match_id: m.id, clear: true })} className="text-red-400 text-xs">↺</button>}
    </div>
  );
}
