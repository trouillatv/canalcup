"use client";

// /admin/notifications — Suivi & diagnostic des notifications push.
// État VAPID, abonnés par plateforme, test d'envoi (à moi / à tous) avec
// résultat PAR abonnement, et purge des abonnements morts.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Megaphone, RefreshCw, Send, Trash2 } from "lucide-react";

interface Status {
  vapid: { configured: boolean; publicKeyTail: string | null; contact: string };
  total: number;
  uniqueUsers: number;
  byPlatform: { apple: number; fcm: number; firefox: number; autre: number };
}
interface Result {
  endpoint: string;
  platform: string;
  ok: boolean;
  code: number | null;
  reason: string;
  dead?: boolean;
}

// Modèles prêts à l'emploi (les 3 push Journée Supporters).
const PRESETS: { label: string; title: string; body: string; url: string }[] = [
  {
    label: "🎭 Concours ouvert",
    title: "🎭 Concours Supporters ouvert !",
    body: "Les publications ouvrent demain (mardi). Votez déjà pour vos binômes préférés !",
    url: "/supporters",
  },
  {
    label: "📸 Publications ouvertes",
    title: "📸 Les publications sont ouvertes !",
    body: "Publiez vos photos et vidéos de déguisement — et votez pour vos binômes préférés !",
    url: "/supporters",
  },
  {
    label: "⏳ 24h pour voter",
    title: "⏳ Plus que 24h pour voter !",
    body: "Les votes de la Journée Supporters ferment jeudi à 23h59. Soutenez vos collègues !",
    url: "/supporters",
  },
];

export default function AdminNotificationsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Composer (envoi d'un vrai message à tous via /api/push/send).
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/supporters");
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    fetch("/api/admin/push/diagnostic")
      .then((r) => r.json())
      .then((d) => setStatus(d.error ? null : d))
      .catch(() => {});
  }, []);

  useEffect(() => loadStatus(), [loadStatus]);

  const run = async (scope: "self" | "all", prune = false) => {
    setBusy(prune ? "prune" : scope);
    setResults(null);
    setNote(null);
    try {
      const res = await fetch("/api/admin/push/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, prune }),
      });
      const d = await res.json();
      if (!res.ok) {
        setNote(d.error ?? "Erreur");
      } else {
        setResults(d.results ?? []);
        setNote(
          `${d.sent}/${d.total} envoyés` +
            (d.pruned ? ` · ${d.pruned} abonnement(s) mort(s) supprimé(s)` : "") +
            (d.note ? ` · ${d.note}` : "")
        );
        loadStatus();
      }
    } catch {
      setNote("Réseau indisponible");
    } finally {
      setBusy(null);
    }
  };

  const broadcast = async () => {
    const t = title.trim();
    const b = body.trim();
    if (t.length < 3 || b.length < 3) {
      setSendNote("Titre et message requis (3 caractères min).");
      return;
    }
    if (!window.confirm(`Envoyer cette notification à TOUS les abonnés ?\n\n${t}\n${b}`)) return;
    setSending(true);
    setSendNote(null);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, body: b, url: url.trim() || "/" }),
      });
      const d = await res.json();
      if (!res.ok) {
        setSendNote(d.error ?? "Envoi impossible.");
      } else {
        setSendNote(`✅ ${d.sent}/${d.total} notification(s) envoyée(s).`);
      }
    } catch {
      setSendNote("Réseau indisponible.");
    } finally {
      setSending(false);
    }
  };

  const deadCount = results?.filter((r) => !r.ok && r.dead).length ?? 0;

  return (
    <div className="px-4 py-4 space-y-5 max-w-2xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-canal-gray-muted hover:text-white"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="canal-headline text-2xl flex items-center gap-2"><Bell size={20} /> Notifications push</h1>
          <p className="text-canal-gray-muted text-sm">Suivi, test et diagnostic</p>
        </div>
      </div>

      {/* État VAPID */}
      <div className="canal-card space-y-2">
        <p className="text-canal-yellow font-bold text-sm">Configuration serveur (VAPID)</p>
        {status ? (
          <div className="text-sm space-y-1">
            <p className={status.vapid.configured ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
              {status.vapid.configured ? "✅ Clés VAPID configurées" : "❌ Clés VAPID MANQUANTES — aucun envoi possible"}
            </p>
            <p className="text-canal-gray-muted text-xs">Clé publique : {status.vapid.publicKeyTail ?? "—"}</p>
            <p className="text-canal-gray-muted text-xs">Contact : {status.vapid.contact}</p>
          </div>
        ) : (
          <p className="text-canal-gray-muted text-sm">Chargement…</p>
        )}
      </div>

      {/* Abonnés */}
      <div className="canal-card">
        <div className="flex items-center justify-between mb-2">
          <p className="text-canal-yellow font-bold text-sm">Abonnés</p>
          <button onClick={loadStatus} className="text-canal-gray-muted hover:text-white"><RefreshCw size={14} /></button>
        </div>
        {status && (
          <>
            <p className="text-white"><span className="font-black text-2xl text-canal-yellow">{status.total}</span> abonnements · {status.uniqueUsers} utilisateurs</p>
            <div className="grid grid-cols-4 gap-2 mt-3 text-center text-xs">
              {([["apple", "🍎 Apple"], ["fcm", "🤖 Android/Chrome"], ["firefox", "🦊 Firefox"], ["autre", "Autre"]] as const).map(([k, label]) => (
                <div key={k} className="bg-canal-gray-mid rounded-lg py-2">
                  <p className="font-black text-white text-lg">{status.byPlatform[k]}</p>
                  <p className="text-canal-gray-muted">{label}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Composer — envoi d'un vrai message à tous */}
      <div className="canal-card space-y-3">
        <p className="text-canal-yellow font-bold text-sm flex items-center gap-2">
          <Megaphone size={15} /> Envoyer une notification
        </p>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => { setTitle(p.title); setBody(p.body); setUrl(p.url); setSendNote(null); }}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold border border-canal-gray-light bg-canal-gray-mid text-canal-gray-muted hover:text-white transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
          maxLength={80}
          className="w-full rounded-xl border border-canal-gray-light bg-canal-gray-mid px-4 py-2.5 text-sm text-white placeholder:text-canal-gray-muted focus:outline-none focus:border-canal-yellow"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message"
          rows={3}
          maxLength={300}
          className="w-full resize-none rounded-xl border border-canal-gray-light bg-canal-gray-mid px-4 py-2.5 text-sm text-white placeholder:text-canal-gray-muted focus:outline-none focus:border-canal-yellow"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Lien à l'ouverture (ex. /supporters)"
          maxLength={200}
          className="w-full rounded-xl border border-canal-gray-light bg-canal-gray-mid px-4 py-2.5 text-xs font-mono text-white placeholder:text-canal-gray-muted focus:outline-none focus:border-canal-yellow"
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-canal-gray-muted">
            Envoi à <span className="font-bold text-white">tous les abonnés</span> ({status?.total ?? 0}).
          </p>
          <button
            onClick={broadcast}
            disabled={sending || title.trim().length < 3 || body.trim().length < 3}
            className="inline-flex items-center gap-2 rounded-xl bg-canal-yellow px-4 py-2 text-sm font-black text-canal-black disabled:opacity-50"
          >
            <Send size={14} /> {sending ? "Envoi…" : "Envoyer à tous"}
          </button>
        </div>
        {sendNote && <p className="text-sm font-bold text-white">{sendNote}</p>}
      </div>

      {/* Actions */}
      <div className="canal-card space-y-3">
        <p className="text-canal-yellow font-bold text-sm">Tester l&apos;envoi</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => run("self")} disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black bg-canal-yellow text-canal-black disabled:opacity-50">
            <Send size={14} /> {busy === "self" ? "Envoi…" : "Test → moi"}
          </button>
          <button onClick={() => run("all")} disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-canal-gray-mid text-white disabled:opacity-50">
            <Send size={14} /> {busy === "all" ? "Envoi…" : "Test → tous"}
          </button>
          <button onClick={() => run("all", true)} disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-950/40 text-red-300 border border-red-800/40 disabled:opacity-50">
            <Trash2 size={14} /> {busy === "prune" ? "Purge…" : "Purger les morts"}
          </button>
        </div>
        <p className="text-[11px] text-canal-gray-muted">
          « Test → moi » envoie sur tes propres appareils abonnés (idéal pour vérifier ton compte). « Purger » supprime les abonnements qui échouent définitivement (clé dépareillée, expirés).
        </p>
        {note && <p className="text-sm text-white font-bold">{note}</p>}
      </div>

      {/* Résultats par abonnement */}
      {results && results.length > 0 && (
        <div className="canal-card">
          <p className="text-canal-yellow font-bold text-sm mb-2">Résultat par abonnement</p>
          {deadCount > 0 && (
            <p className="text-xs text-red-300 mb-2">
              {deadCount} abonnement(s) à re-souscrire (souvent : clé VAPID changée → les abonnés doivent réactiver les notifs).
            </p>
          )}
          <div className="space-y-1.5">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${r.ok ? "bg-green-950/30" : "bg-red-950/30"}`}>
                <span>{r.platform === "apple" ? "🍎" : r.platform === "fcm" ? "🤖" : r.platform === "firefox" ? "🦊" : "•"}</span>
                <span className="font-mono text-canal-gray-muted flex-1 truncate">{r.endpoint}</span>
                <span className={`font-bold ${r.ok ? "text-green-400" : "text-red-400"}`}>
                  {r.ok ? "OK" : `${r.code ?? ""} ${r.reason}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
