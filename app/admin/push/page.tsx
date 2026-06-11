"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Send, RefreshCw } from "lucide-react";

interface PushStats {
  subscribed: number;
  total: number;
  subscribers: {
    user_id: string;
    display_name: string;
    email: string;
    login: string;
    country: string;
    endpoint: string;
  }[];
  nonSubscribers: { id: string; display_name: string }[];
}

export default function AdminPushPage() {
  const [stats, setStats] = useState<PushStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("Canal Cup 2026");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/push/stats")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    setResult(null);
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    const d = await res.json();
    setResult(d);
    setSending(false);
  };

  return (
    <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <h1 className="canal-headline text-2xl">Notifications Push</h1>
        <button onClick={load} className="p-2 text-canal-gray-muted hover:text-white transition-colors">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="canal-card text-center">
            <Bell size={20} className="text-canal-yellow mx-auto mb-1" />
            <p className="font-black text-2xl text-canal-yellow">{stats.subscribed}</p>
            <p className="text-xs text-canal-gray-muted">push activé</p>
          </div>
          <div className="canal-card text-center">
            <BellOff size={20} className="text-canal-gray-muted mx-auto mb-1" />
            <p className="font-black text-2xl text-white">{stats.total - stats.subscribed}</p>
            <p className="text-xs text-canal-gray-muted">sans push</p>
          </div>
        </div>
      )}

      {/* Formulaire d'envoi */}
      <div className="canal-card space-y-3">
        <p className="text-canal-yellow font-bold text-sm flex items-center gap-2">
          <Send size={14} /> Envoyer un push à tous les abonnés ({stats?.subscribed ?? 0})
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
          className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-3 py-2 text-sm text-white placeholder:text-canal-gray-muted outline-none focus:border-canal-yellow/50"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message…"
          rows={3}
          className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-3 py-2 text-sm text-white placeholder:text-canal-gray-muted outline-none focus:border-canal-yellow/50 resize-none"
        />
        <button
          onClick={send}
          disabled={sending || !body.trim()}
          className="w-full py-2.5 bg-canal-yellow text-canal-black font-black rounded-xl text-sm disabled:opacity-40 hover:bg-canal-yellow-hover transition-colors"
        >
          {sending ? "Envoi…" : "Envoyer"}
        </button>
        {result && (
          <p className="text-xs text-center text-green-400">
            ✓ Envoyé à {result.sent}/{result.total} abonné{result.total > 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Liste abonnés */}
      {stats && stats.subscribers.length > 0 && (
        <div>
          <p className="text-xs font-bold text-canal-yellow uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Bell size={12} /> Abonnés ({stats.subscribers.length})
          </p>
          <div className="space-y-1">
            {stats.subscribers.map((u) => (
              <div key={u.user_id} className="canal-card py-2.5 flex items-center gap-2">
                <Bell size={13} className="text-canal-yellow shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {u.display_name} <span className="text-canal-gray-muted">({u.login})</span>
                  </p>
                  <p className="text-xs text-canal-gray-muted truncate">
                    {u.country}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-abonnés */}
      {stats && stats.nonSubscribers.length > 0 && (
        <div>
          <p className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <BellOff size={12} /> Sans push ({stats.nonSubscribers.length})
          </p>
          <p className="text-xs text-canal-gray-muted mb-2 italic">
            Impossible d&apos;envoyer un push sans consentement préalable. Ces utilisateurs verront la bannière d&apos;activation à leur prochaine connexion.
          </p>
          <div className="space-y-1">
            {stats.nonSubscribers.map((u) => (
              <div key={u.id} className="canal-card py-2.5 flex items-center gap-2 opacity-50">
                <BellOff size={13} className="text-canal-gray-muted shrink-0" />
                <span className="text-sm text-canal-gray-muted">{u.display_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
