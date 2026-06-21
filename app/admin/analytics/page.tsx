"use client";

// /admin/analytics — usage & connexions. Pages utilisées/inutilisées + fréquence,
// joueurs actifs, dernière connexion par joueur. Données : page_views (suivi
// démarré au déploiement) + users.last_login_at.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, RefreshCw, LogIn, EyeOff, ArrowLeft } from "lucide-react";

interface PageRow { path: string; views: number; users: number; last: string }
interface UserRow { id: string; name: string; email: string | null; last_login_at: string | null; views: number }
interface Data {
  days: number; totalViews: number;
  pages: PageRow[]; unused: string[];
  logins: { totalUsers: number; neverLoggedIn: number; active24h: number; active7d: number; active30d: number };
  users: UserRow[];
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

const RANGES = [7, 30, 90];

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?days=${d}`, { credentials: "same-origin" });
      if (res.ok) setData(await res.json());
    } catch { /* silencieux */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-canal-gray-muted hover:text-white text-sm">
        <ArrowLeft size={15} /> Dashboard admin
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="canal-headline text-2xl flex items-center gap-2"><BarChart3 size={22} className="text-canal-yellow" /> Usage & connexions</h1>
          <p className="text-canal-gray-muted text-sm mt-1">Pages utilisées, fréquence et joueurs actifs.</p>
        </div>
        <button onClick={() => load(days)} className="text-xs text-canal-gray-muted hover:text-white flex items-center gap-1 shrink-0 mt-1">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Recharger
        </button>
      </div>

      {/* Sélecteur de période */}
      <div className="flex gap-1.5">
        {RANGES.map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${days === d ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-canal-gray-muted hover:text-white"}`}>
            {d} jours
          </button>
        ))}
      </div>

      {!data ? (
        <p className="text-center text-canal-gray-muted text-sm py-12">{loading ? "Chargement…" : "Aucune donnée."}</p>
      ) : (
        <>
          {/* ── Connexions ── */}
          <section className="space-y-2">
            <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5"><LogIn size={13} /> Connexions</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Joueurs inscrits", value: data.logins.totalUsers },
                { label: "Actifs 24 h", value: data.logins.active24h },
                { label: "Actifs 7 j", value: data.logins.active7d },
                { label: "Jamais connectés", value: data.logins.neverLoggedIn, warn: true },
              ].map((c) => (
                <div key={c.label} className={`bg-canal-gray-mid rounded-xl px-3 py-3 text-center border ${c.warn ? "border-red-500/30" : "border-canal-gray-light"}`}>
                  <p className={`font-black text-2xl tabular-nums leading-tight ${c.warn ? "text-red-400" : "text-canal-yellow"}`}>{c.value}</p>
                  <p className="text-[10px] text-canal-gray-muted uppercase tracking-wider mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Pages utilisées ── */}
          <section className="space-y-2">
            <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider">Pages les plus vues · {data.totalViews} vues / {data.days} j</p>
            <p className="text-[10px] text-canal-gray-muted">Les entrées <span className="font-mono">#onglet</span> = onglets consultés (ex. <span className="font-mono">/matches/[id]#notes</span>).</p>
            {data.pages.length === 0 ? (
              <p className="text-canal-gray-muted text-sm py-4 text-center">Aucune vue enregistrée. Le suivi démarre au déploiement — laisse les joueurs naviguer puis recharge.</p>
            ) : (
              <div className="canal-card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-canal-gray-light text-canal-gray-muted text-[11px]">
                    <th className="text-left px-3 py-2 font-bold">Page</th>
                    <th className="text-right px-2 py-2 font-bold">Vues</th>
                    <th className="text-right px-2 py-2 font-bold">Joueurs</th>
                    <th className="text-right px-3 py-2 font-bold">Dernière</th>
                  </tr></thead>
                  <tbody>
                    {data.pages.map((p) => (
                      <tr key={p.path} className="border-b border-canal-gray-light/30">
                        <td className="px-3 py-2 text-white font-mono text-xs truncate max-w-[160px]">{p.path}</td>
                        <td className="px-2 py-2 text-right text-canal-yellow font-black tabular-nums">{p.views}</td>
                        <td className="px-2 py-2 text-right text-white tabular-nums">{p.users}</td>
                        <td className="px-3 py-2 text-right text-canal-gray-muted text-[11px] whitespace-nowrap">{fmt(p.last)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Pages inutilisées ── */}
          <section className="space-y-2">
            <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5"><EyeOff size={13} /> Pages sans vue ({data.unused.length})</p>
            {data.unused.length === 0 ? (
              <p className="text-canal-gray-muted text-sm">Toutes les pages connues ont été vues 🎉</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.unused.map((p) => (
                  <span key={p} className="font-mono text-[11px] text-canal-gray-muted bg-canal-gray-mid border border-canal-gray-light rounded px-2 py-1">{p}</span>
                ))}
              </div>
            )}
          </section>

          {/* ── Par joueur ── */}
          <section className="space-y-2">
            <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider">Joueurs · dernière connexion</p>
            <div className="canal-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-canal-gray-light text-canal-gray-muted text-[11px]">
                  <th className="text-left px-3 py-2 font-bold">Joueur</th>
                  <th className="text-right px-2 py-2 font-bold">Vues</th>
                  <th className="text-right px-3 py-2 font-bold">Dernière connexion</th>
                </tr></thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} className="border-b border-canal-gray-light/30">
                      <td className="px-3 py-2">
                        <Link href={`/joueur/${u.id}`} className="text-white font-bold hover:text-canal-yellow transition-colors">{u.name}</Link>
                        {u.email && <span className="block text-[10px] text-canal-gray-muted truncate">{u.email}</span>}
                      </td>
                      <td className="px-2 py-2 text-right text-white tabular-nums">{u.views}</td>
                      <td className={`px-3 py-2 text-right text-[11px] whitespace-nowrap ${u.last_login_at ? "text-canal-gray-muted" : "text-red-400"}`}>
                        {u.last_login_at ? fmt(u.last_login_at) : "jamais"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
