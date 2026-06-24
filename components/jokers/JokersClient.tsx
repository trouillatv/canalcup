"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  JOKER_CATALOG,
  ALL_JOKER_TYPES,
  KAMIKAZE_MIN_STAKE,
  KAMIKAZE_MAX_STAKE,
  KAMIKAZE_WIN_MULTIPLIER,
  type JokerType,
  type JokerDef,
} from "@/lib/jokers/catalog";

interface Player { id: string; name: string }
interface MatchRow { id: string; team_a: string; team_b: string; starts_at: string; status: string; phase: string | null }
interface WalletRow { joker_type: string; quantity: number }
interface EffectRow { id: string; effect_type: string; match_id: string | null; ends_at: string | null; metadata: Record<string, unknown> }
interface PlayRow { id: string; joker_type: string; status: string; metadata: Record<string, unknown>; created_at: string }

interface Data {
  userId: string;
  wallet: WalletRow[];
  effects: EffectRow[];
  players: Player[];
  matches: MatchRow[];
  myPlays: PlayRow[];
}

const EFFECT_LABEL: Record<string, string> = {
  red_card_block: "🚫 Carton Rouge (suspendu sur un match)",
  fog: "🌫 Brouillard (tu ne vois plus les autres, modifs bloquées)",
  flight_delay: "✈️ Retard d'Avion (modifs bloquées)",
  // 🛬 jet_lag : volontairement absent — l'effet est masqué à la victime
  // (filtré côté /api/jokers). Elle ne le découvre qu'au coup de sifflet final.
  var_window: "🎥 VAR (modif jusqu'à la mi-temps)",
  spy: "🕵️ Espion (consulte les pronos des autres)",
};

function matchLabel(m: MatchRow): string {
  const d = new Date(m.starts_at);
  return `${m.team_a} – ${m.team_b} · ${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function JokersClient() {
  const [data, setData] = useState<Data | null>(null);
  const [openType, setOpenType] = useState<JokerType | null>(null);
  const [targetId, setTargetId] = useState("");
  const [matchId, setMatchId] = useState("");
  const [stake, setStake] = useState(10); // 💣 mise Kamikaze (1..20)
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/jokers")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  const qty = (t: JokerType) => data?.wallet.find((w) => w.joker_type === t)?.quantity ?? 0;

  const open = (t: JokerType) => {
    setOpenType((prev) => (prev === t ? null : t));
    setTargetId("");
    setMatchId("");
    setStake(10);
    setConfirming(false);
    setFlash(null);
  };

  const play = async (def: JokerDef) => {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/jokers/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: def.type,
          target_user_id: targetId || undefined,
          match_id: matchId || undefined,
          stake: def.type === "kamikaze" ? stake : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setFlash({ kind: "err", msg: d.error ?? "Échec." });
      } else {
        setFlash({ kind: "ok", msg: d.publicMessage ?? "Joker joué !" });
        setOpenType(null);
        setConfirming(false);
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return <div className="text-canal-gray-muted text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Chargement…</div>;
  }

  const hasSpy = data.effects.some((e) => e.effect_type === "spy");

  return (
    <div className="space-y-5">
      {/* Effets actifs sur moi */}
      {data.effects.length > 0 && (
        <section className="canal-card border border-purple-500/30">
          <h2 className="text-xs text-purple-400 font-bold uppercase mb-2">Effets actifs sur toi</h2>
          <ul className="space-y-1 text-sm">
            {data.effects.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span>{EFFECT_LABEL[e.effect_type] ?? e.effect_type}</span>
                {e.ends_at && (
                  <span className="text-xs text-canal-gray-muted shrink-0">
                    jusqu'au {new Date(e.ends_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Succès en haut (le panneau se ferme). Les ERREURS, elles, s'affichent
          DANS la carte du joker concerné, au plus près du bouton. */}
      {flash?.kind === "ok" && (
        <div className="text-sm rounded-lg p-3 bg-green-950/30 text-green-300 border border-green-500/30">
          {flash.msg}
        </div>
      )}

      {/* Espion : consultation */}
      {hasSpy && <SpyPanel />}

      {/* Catalogue / wallet */}
      <section className="space-y-3">
        <h2 className="text-xs text-canal-yellow font-bold uppercase">Tes jokers</h2>
        {ALL_JOKER_TYPES.map((t) => {
          const def = JOKER_CATALOG[t];
          const n = qty(t);
          const isOpen = openType === t;
          const needsTarget = def.targeting === "target" || def.targeting === "target_match";
          const needsMatch = def.targeting === "self_match" || def.targeting === "target_match";
          // Matchs proposables pour CE joker (VAR = non terminé ; sinon à venir).
          const availableMatches = needsMatch
            ? data.matches.filter((m) => (def.type === "var" ? m.status !== "finished" : m.status === "upcoming"))
            : [];
          // Pourquoi le joker ne peut pas (encore) être validé ? On l'explique au
          // joueur au lieu de laisser un bouton grisé muet.
          const blockers: string[] = [];
          if (needsTarget && data.players.length === 0) blockers.push("aucune cible disponible");
          else if (needsTarget && !targetId) blockers.push("choisis une cible");
          if (needsMatch && availableMatches.length === 0) blockers.push(def.type === "var" ? "aucun match en cours ou à venir" : "aucun match à venir à viser");
          else if (needsMatch && !matchId) blockers.push("choisis un match");
          const blockReason = blockers.length ? blockers.join(" · ") : null;
          return (
            <div key={t} className={`canal-card ${n === 0 ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    <span className="text-lg">{def.emoji}</span> {def.name}
                    {def.offensive && <span className="text-[10px] uppercase bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded">offensif</span>}
                  </p>
                  <p className="text-xs text-canal-gray-muted mt-0.5">{def.description}</p>
                  <p className="text-[11px] text-canal-gray-muted/70 mt-1 italic">{def.conditions}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-purple-300 font-bold">×{n}</span>
                </div>
              </div>
              <div className="mt-3">
                <button
                  disabled={n === 0}
                  onClick={() => open(t)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-canal-yellow text-canal-black disabled:bg-canal-gray-light disabled:text-canal-gray-muted"
                >
                  {isOpen ? "Annuler" : "Jouer"}
                </button>
              </div>

              {isOpen && (
                <div className="mt-3 space-y-2 border-t border-canal-gray-light pt-3">
                  {needsTarget && (
                    <select
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="w-full bg-canal-black border border-canal-gray-light rounded-lg px-2 py-2 text-sm"
                    >
                      <option value="">— Choisir une cible —</option>
                      {data.players.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                  {needsMatch && (
                    <select
                      value={matchId}
                      onChange={(e) => setMatchId(e.target.value)}
                      className="w-full bg-canal-black border border-canal-gray-light rounded-lg px-2 py-2 text-sm"
                    >
                      <option value="">— Choisir un match —</option>
                      {availableMatches.map((m) => (
                        <option key={m.id} value={m.id}>{matchLabel(m)}</option>
                      ))}
                    </select>
                  )}
                  {def.type === "kamikaze" && (
                    <div className="rounded-lg border border-canal-gray-light bg-canal-black/40 p-3 space-y-2">
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold">💣 Ta mise</span>
                        <input
                          type="number"
                          min={KAMIKAZE_MIN_STAKE}
                          max={KAMIKAZE_MAX_STAKE}
                          value={stake}
                          onChange={(e) => {
                            const v = Math.round(Number(e.target.value));
                            setStake(Number.isFinite(v) ? Math.max(KAMIKAZE_MIN_STAKE, Math.min(KAMIKAZE_MAX_STAKE, v)) : KAMIKAZE_MIN_STAKE);
                          }}
                          className="w-20 bg-canal-black border border-canal-gray-light rounded-lg px-2 py-1.5 text-sm text-right tabular-nums"
                        />
                      </label>
                      <input
                        type="range"
                        min={KAMIKAZE_MIN_STAKE}
                        max={KAMIKAZE_MAX_STAKE}
                        value={stake}
                        onChange={(e) => setStake(Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                      <p className="text-xs text-canal-gray-muted">
                        Score exact → <span className="text-green-300 font-bold">+{KAMIKAZE_WIN_MULTIPLIER * stake} pts</span>
                        {" · "}sinon → <span className="text-red-300 font-bold">−{stake} pts</span>
                      </p>
                    </div>
                  )}
                  {!confirming && blockReason && (
                    <p className="text-xs text-amber-300 bg-amber-950/20 border border-amber-500/30 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                      <span className="shrink-0">⚠️</span>
                      <span>Pour jouer ce joker : <span className="font-semibold">{blockReason.charAt(0).toUpperCase() + blockReason.slice(1)}</span>.</span>
                    </p>
                  )}
                  {!confirming ? (
                    <button
                      disabled={busy || !!blockReason}
                      onClick={() => setConfirming(true)}
                      className="w-full text-sm font-bold px-3 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Jouer {def.emoji}
                    </button>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-950/20 p-3">
                      <p className="text-xs text-amber-200">
                        ⚠️ Une fois joué, <span className="font-bold">{def.name}</span> est définitivement
                        consommé : tu n'auras pas d'autre joker de ce type pour le reste du tournoi.
                        Jouer maintenant&nbsp;?
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => play(def)}
                          className="flex-1 text-sm font-bold px-3 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-40"
                        >
                          {busy ? "…" : `Oui, jouer ${def.emoji}`}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => setConfirming(false)}
                          className="flex-1 text-sm font-bold px-3 py-2 rounded-lg bg-canal-gray-light text-white disabled:opacity-40"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Erreur serveur (cible déjà ciblée, match commencé, prono
                      manquant, mise invalide…) affichée ICI, jamais en silence. */}
                  {flash?.kind === "err" && (
                    <p className="text-xs text-red-300 bg-red-950/30 border border-red-500/30 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                      <span className="shrink-0">🚫</span>
                      <span>{flash.msg}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Historique court */}
      {data.myPlays.length > 0 && (
        <section className="canal-card">
          <h2 className="text-xs text-canal-yellow font-bold uppercase mb-2">Historique</h2>
          <ul className="space-y-1 text-xs text-canal-gray-muted">
            {data.myPlays.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span>{JOKER_CATALOG[p.joker_type as JokerType]?.emoji ?? "🃏"} {JOKER_CATALOG[p.joker_type as JokerType]?.name ?? p.joker_type}</span>
                <span>
                  {typeof (p.metadata as { points_delta?: number })?.points_delta === "number"
                    ? `${(p.metadata as { points_delta: number }).points_delta > 0 ? "+" : ""}${(p.metadata as { points_delta: number }).points_delta} pts · `
                    : ""}
                  {new Date(p.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ── Espion : panneau de consultation ─────────────────────────────────────────
interface SpyMatch { id: string; team_a: string; team_b: string; starts_at: string }
function SpyPanel() {
  const [status, setStatus] = useState<{ active: boolean; remaining: number; viewedMatchIds: string[]; matches: SpyMatch[] } | null>(null);
  const [details, setDetails] = useState<{ name: string; predicted_score_a: number | null; predicted_score_b: number | null }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/jokers/spy").then((r) => r.json()).then((d) => { if (d.active) setStatus(d); }).catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  const consult = async (matchId: string) => {
    setBusy(true); setErr(null); setDetails(null);
    try {
      const res = await fetch("/api/jokers/spy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });
      const d = await res.json();
      if (!res.ok) setErr(d.error ?? "Échec.");
      else { setDetails(d.details ?? []); load(); }
    } finally { setBusy(false); }
  };

  if (!status) return null;

  return (
    <section className="canal-card border border-indigo-500/40">
      <h2 className="text-xs text-indigo-300 font-bold uppercase mb-1">🕵️ Espion actif</h2>
      <p className="text-xs text-canal-gray-muted mb-2">Consultations restantes : <span className="text-white font-bold">{status.remaining}</span> / 5</p>
      {err && <p className="text-xs text-red-300 mb-2">{err}</p>}
      <select
        defaultValue=""
        disabled={busy || status.remaining === 0}
        onChange={(e) => e.target.value && consult(e.target.value)}
        className="w-full bg-canal-black border border-canal-gray-light rounded-lg px-2 py-2 text-sm"
      >
        <option value="">— Consulter un match —</option>
        {status.matches.map((m) => (
          <option key={m.id} value={m.id}>
            {status.viewedMatchIds.includes(m.id) ? "✓ " : ""}{m.team_a} – {m.team_b}
          </option>
        ))}
      </select>
      {details && (
        <ul className="mt-3 space-y-1 text-sm">
          {details.length === 0 && <li className="text-canal-gray-muted text-xs">Personne n'a encore pronostiqué.</li>}
          {details.map((d, i) => (
            <li key={i} className="flex items-center justify-between">
              <span>{d.name}</span>
              <span className="font-mono text-canal-yellow">{d.predicted_score_a}–{d.predicted_score_b}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
