"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Lock, MessageCircle, Send, Shirt, Sparkles, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VestiaireChannel, VestiaireMessage } from "@/lib/supabase/types";

type VestiaireMessageView = VestiaireMessage & {
  reactions?: Record<string, number>;
  mine_reactions?: string[];
  reaction_count?: number;
};

const REACTIONS = ["🔥", "😂", "👏", "😱"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function channelIcon(channel: VestiaireChannel) {
  if (channel.type === "team") return Shirt;
  if (channel.type === "match") return Calendar;
  if (channel.type === "animation") return Sparkles;
  if (channel.is_private) return Lock;
  return Users;
}

function channelTheme(channel: VestiaireChannel) {
  if (channel.type === "team") {
    return {
      label: "Equipe",
      accent: "bg-green-400",
      text: "text-green-200",
      icon: "text-green-200",
      idle: "border-green-500/25 bg-green-950/20 hover:bg-green-900/25",
      active: "border-green-300/70 bg-green-400/15 ring-1 ring-green-300/30",
      badge: "bg-green-300/15 text-green-100 border-green-300/25",
    };
  }
  if (channel.type === "animation") {
    return {
      label: "Animations",
      accent: "bg-fuchsia-300",
      text: "text-fuchsia-200",
      icon: "text-fuchsia-200",
      idle: "border-fuchsia-500/25 bg-fuchsia-950/20 hover:bg-fuchsia-900/25",
      active: "border-fuchsia-300/70 bg-fuchsia-400/15 ring-1 ring-fuchsia-300/30",
      badge: "bg-fuchsia-300/15 text-fuchsia-100 border-fuchsia-300/25",
    };
  }
  if (channel.type === "match") {
    return {
      label: "Match",
      accent: "bg-sky-300",
      text: "text-sky-200",
      icon: "text-sky-200",
      idle: "border-sky-500/25 bg-sky-950/20 hover:bg-sky-900/25",
      active: "border-sky-300/70 bg-sky-400/15 ring-1 ring-sky-300/30",
      badge: "bg-sky-300/15 text-sky-100 border-sky-300/25",
    };
  }
  return {
    label: "General",
    accent: "bg-canal-yellow",
    text: "text-canal-yellow",
    icon: "text-canal-yellow",
    idle: "border-canal-yellow/20 bg-canal-yellow/5 hover:bg-canal-yellow/10",
    active: "border-canal-yellow/70 bg-canal-yellow/15 ring-1 ring-canal-yellow/30",
    badge: "bg-canal-yellow/15 text-canal-yellow border-canal-yellow/25",
  };
}

export default function VestiairePage() {
  const [channels, setChannels] = useState<VestiaireChannel[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [messages, setMessages] = useState<VestiaireMessageView[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reacting, setReacting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === activeId) ?? channels[0],
    [channels, activeId]
  );

  const fetchChannels = async () => {
    const res = await fetch("/api/vestiaire/channels", { cache: "no-store" });
    const data = await res.json();
    if (Array.isArray(data)) {
      setChannels(data);
      setActiveId((current) => current || data[0]?.id || "");
    }
  };

  const fetchMessages = async (channelId: string) => {
    if (!channelId) return;
    const res = await fetch(`/api/vestiaire/messages?channel_id=${encodeURIComponent(channelId)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (Array.isArray(data)) setMessages(data);
  };

  useEffect(() => {
    fetchChannels().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeChannel?.id) fetchMessages(activeChannel.id);
  }, [activeChannel?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannel) return;
    setSending(true);
    setError("");
    const res = await fetch("/api/vestiaire/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: activeChannel.id, body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Message impossible.");
      setSending(false);
      return;
    }
    setBody("");
    await fetchMessages(activeChannel.id);
    setSending(false);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!activeChannel) return;
    setReacting(`${messageId}:${emoji}`);
    setError("");
    const res = await fetch(`/api/vestiaire/messages/${messageId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Reaction impossible.");
    }
    await fetchMessages(activeChannel.id);
    setReacting(null);
  };

  return (
    <div className="px-4 py-4 max-w-4xl mx-auto space-y-5">
      <header className="rounded-2xl border border-canal-yellow/20 bg-canal-yellow/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-canal-yellow text-canal-black flex items-center justify-center">
            <MessageCircle size={21} />
          </div>
          <div>
            <h1 className="canal-headline text-2xl">Vestiaire</h1>
            <p className="text-sm text-canal-gray-muted mt-0.5">
              Clashs propres, salons thematiques et reactions qui comptent.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-[250px_1fr]">
        <aside className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-black uppercase text-canal-gray-muted tracking-wider">Salons</p>
            <span className="text-xs text-canal-gray-muted">{channels.length}</span>
          </div>

          {loading && <div className="canal-card text-canal-gray-muted text-sm">Chargement...</div>}
          {channels.map((channel) => {
            const Icon = channelIcon(channel);
            const theme = channelTheme(channel);
            const active = channel.id === activeChannel?.id;
            return (
              <button
                key={channel.id}
                onClick={() => setActiveId(channel.id)}
                className={cn(
                  "group relative w-full overflow-hidden rounded-2xl border px-3 py-3 text-left transition-all duration-150",
                  active ? theme.active : theme.idle
                )}
              >
                <span className={cn("absolute inset-y-0 left-0 w-1", theme.accent)} />
                <div className="flex items-start gap-3 pl-1">
                  <div className={cn("mt-0.5 h-9 w-9 rounded-xl border flex items-center justify-center", theme.badge)}>
                    <Icon size={17} className={theme.icon} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-white truncate">{channel.title}</span>
                      {channel.is_private && <Lock size={12} className={theme.text} />}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black uppercase", theme.badge)}>
                        {theme.label}
                      </span>
                      {active && <span className="text-[10px] font-bold text-white/70">Ouvert</span>}
                    </div>
                  </div>
                </div>
                {channel.description && (
                  <p className="text-xs text-canal-gray-muted mt-2 pl-1 line-clamp-2">{channel.description}</p>
                )}
              </button>
            );
          })}
        </aside>

        <section className="rounded-2xl border border-canal-gray-light bg-canal-gray min-h-[540px] flex flex-col overflow-hidden">
          <div className="border-b border-canal-gray-light bg-canal-gray-mid/45 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-black">{activeChannel?.title ?? "Aucun salon"}</p>
                <p className="text-xs text-canal-gray-muted mt-1">
                  {activeChannel?.is_private ? "Salon prive d'equipe" : "Salon public Canal Cup"}
                </p>
              </div>
              {activeChannel && (
                <span className={cn("shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase", channelTheme(activeChannel).badge)}>
                  {channelTheme(activeChannel).label}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((message) => {
              const author = message.display_name ?? message.email ?? "Supporter";
              return (
                <div key={message.id} className="rounded-2xl bg-[#33291d] border border-canal-yellow/10 px-3 py-3 shadow-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-canal-yellow text-xs font-black text-canal-black">
                      {author[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span className="font-black text-white text-sm">{author}</span>
                    <span className="text-xs text-canal-gray-muted">{formatTime(message.created_at)}</span>
                    {(message.reaction_count ?? 0) > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-canal-yellow/25 bg-canal-yellow/10 px-2 py-0.5 text-[11px] font-black text-canal-yellow">
                        <Trophy size={11} />
                        +{message.reaction_count} social
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] text-white mt-2 leading-relaxed whitespace-pre-wrap">{message.body}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {REACTIONS.map((emoji) => {
                      const count = message.reactions?.[emoji] ?? 0;
                      const mine = message.mine_reactions?.includes(emoji) ?? false;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleReaction(message.id, emoji)}
                          disabled={reacting === `${message.id}:${emoji}`}
                          className={cn(
                            "min-h-9 rounded-full border px-2.5 text-sm font-black transition-colors disabled:opacity-60",
                            mine
                              ? "border-canal-yellow bg-canal-yellow text-canal-black"
                              : "border-canal-gray-light bg-canal-black/25 text-white hover:border-canal-yellow/50"
                          )}
                        >
                          <span>{emoji}</span>
                          {count > 0 && <span className="ml-1 text-xs tabular-nums">{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!loading && messages.length === 0 && (
              <div className="h-full min-h-[260px] flex items-center justify-center text-center">
                <div className="rounded-2xl border border-dashed border-canal-gray-light bg-canal-gray-mid/40 px-6 py-8">
                  <MessageCircle size={32} className="mx-auto mb-2 text-canal-gray-muted" />
                  <p className="font-bold text-white">Ce salon est calme.</p>
                  <p className="text-sm text-canal-gray-muted mt-1">Un 2-0 annonce trop tot peut suffire.</p>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={submit} className="border-t border-canal-gray-light bg-canal-gray-mid/50 p-3">
            <div className="flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message de vestiaire..."
                maxLength={1000}
                className="min-w-0 flex-1 rounded-xl border border-canal-gray-light bg-canal-black/40 px-4 py-3 text-sm text-white placeholder:text-canal-gray-muted focus:outline-none focus:border-canal-yellow"
              />
              <button
                type="submit"
                disabled={sending || body.trim().length < 3 || !activeChannel}
                className="min-h-11 min-w-11 rounded-xl bg-canal-yellow px-4 py-3 text-canal-black font-black disabled:opacity-50"
                aria-label="Envoyer"
              >
                <Send size={17} />
              </button>
            </div>
            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
          </form>
        </section>
      </div>
    </div>
  );
}
