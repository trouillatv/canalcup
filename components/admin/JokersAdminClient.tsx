"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { JOKER_CATALOG, ALL_JOKER_TYPES, type JokerType } from "@/lib/jokers/catalog";

interface PlayerRow { id: string; name: string; wallet: Record<string, number> }
interface HistoryRow {
  id: string; joker_type: string; playerName: string; targetName: string | null;
  status: string; metadata: Record<string, unknown>; created_at: string;
}
interface CountRow { id: string; name: string; count: number }
interface EffectRow { id: string; effect_type: string; affectedName: string; ends_at: string | null; match_id: string | null }

interface Overview {
  players: PlayerRow[];
  history: HistoryRow[];
  mostTargeted: CountRow[];
  redCards: CountRow[];
  activeEffects: EffectRow[];
}

const EFFECT_LABEL: Record<string, string> = {
  red_card_block: "🚫 Carton Rouge",
  fog: "🌫 Brouillard",
  jet_lag: "🛬 Jet Lag (jugé sur la 2e mi-temps)",
  flight_delay: "✈️ Retard d'Avion (déprécié)",
  var_window: "🎥 VAR",
  spy: "🕵️ Espion",
};

export function JokersAdminClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [userId, setUserId] = useState("");
  const [jokerType, setJokerType] = useState<JokerType>("casino");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/jokers")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  const act = async (action: "grant" | "revoke") => {
    if (!userId) { setMsg("Choisis un joueur."); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/jokers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, user_id: userId, joker_type: jokerType, quantity: qty }),
      });
      const d = await res.json();
      setMsg(res.ok ? "✓ Fait." : d.error ?? "Échec.");
      if (res.ok) load();
    } finally { setBusy(false); }
  };

  if (!data) {
    return <div className="text-canal-gray-muted text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Chargement…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Attribution */}
      <section className="canal-card space-y-3">
        <h2 className="text-xs text-canal-yellow font-bold uppercase">Attribuer / retirer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="bg-canal-black border border-canal-gray-light rounded-lg px-2 py-2 text-sm">
            <option value="">— Joueur —</option>
            {data.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={jokerType} onChange={(e) => setJokerType(e.target.value as JokerType)} className="bg-canal-black border border-canal-gray-light rounded-lg px-2 py-2 text-sm">
            {ALL_JOKER_TYPES.map((t) => <option key={t} value={t}>{JOKER_CATALOG[t].emoji} {JOKER_CATALOG[t].name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))} className="w-20 bg-canal-black border border-canal-gray-light rounded-lg px-2 py-2 text-sm" />
          <button disabled={busy} onClick={() => act("grant")} className="text-sm font-bold px-3 py-2 rounded-lg bg-canal-yellow text-canal-black disabled:opacity-40">Attribuer</button>
          <button disabled={busy} onClick={() => act("revoke")} className="text-sm font-bold px-3 py-2 rounded-lg bg-canal-gray-light text-white disabled:opacity-40">Retirer</button>
          {msg && <span className="text-xs text-canal-gray-muted">{msg}</span>}
        </div>
      </section>

      {/* Effets actifs */}
      <section className="canal-card">
        <h2 className="text-xs text-canal-yellow font-bold uppercase mb-2">Effets actifs ({data.activeEffects.length})</h2>
        {data.activeEffects.length === 0 ? (
          <p className="text-xs text-canal-gray-muted">Aucun effet actif.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.activeEffects.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span>{EFFECT_LABEL[e.effect_type] ?? e.effect_type} → <span className="font-bold">{e.affectedName}</span></span>
                {e.ends_at && <span className="text-xs text-canal-gray-muted shrink-0">{new Date(e.ends_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Cartons + plus ciblés */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <section className="canal-card">
          <h2 className="text-xs text-canal-yellow font-bold uppercase mb-2">🚫 Cartons reçus</h2>
          {data.redCards.length === 0 ? <p className="text-xs text-canal-gray-muted">Aucun.</p> : (
            <ul className="space-y-1 text-sm">{data.redCards.map((r) => <li key={r.id} className="flex justify-between"><span>{r.name}</span><span className="font-bold">{r.count}</span></li>)}</ul>
          )}
        </section>
        <section className="canal-card">
          <h2 className="text-xs text-canal-yellow font-bold uppercase mb-2">🎯 Plus ciblés</h2>
          {data.mostTargeted.length === 0 ? <p className="text-xs text-canal-gray-muted">Aucun.</p> : (
            <ul className="space-y-1 text-sm">{data.mostTargeted.map((r) => <li key={r.id} className="flex justify-between"><span>{r.name}</span><span className="font-bold">{r.count}</span></li>)}</ul>
          )}
        </section>
      </div>

      {/* Joueurs + wallets */}
      <section className="canal-card overflow-x-auto">
        <h2 className="text-xs text-canal-yellow font-bold uppercase mb-2">Possession des jokers</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-canal-gray-muted text-left">
              <th className="py-1 pr-2">Joueur</th>
              {ALL_JOKER_TYPES.map((t) => <th key={t} className="py-1 px-1 text-center" title={JOKER_CATALOG[t].name}>{JOKER_CATALOG[t].emoji}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.id} className="border-t border-canal-gray-light/40">
                <td className="py-1 pr-2 whitespace-nowrap">{p.name}</td>
                {ALL_JOKER_TYPES.map((t) => (
                  <td key={t} className={`py-1 px-1 text-center ${p.wallet[t] ? "text-white font-bold" : "text-canal-gray-muted/40"}`}>{p.wallet[t] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Historique */}
      <section className="canal-card">
        <h2 className="text-xs text-canal-yellow font-bold uppercase mb-2">Historique des jokers joués</h2>
        <ul className="space-y-1 text-xs">
          {data.history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 border-t border-canal-gray-light/30 py-1">
              <span>
                {JOKER_CATALOG[h.joker_type as JokerType]?.emoji ?? "🃏"} <span className="font-bold">{h.playerName}</span>
                {h.targetName ? <> → {h.targetName}</> : null}
                {typeof (h.metadata as { points_delta?: number })?.points_delta === "number" && (
                  <> ({(h.metadata as { points_delta: number }).points_delta > 0 ? "+" : ""}{(h.metadata as { points_delta: number }).points_delta} pts)</>
                )}
              </span>
              <span className="text-canal-gray-muted shrink-0">{new Date(h.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
