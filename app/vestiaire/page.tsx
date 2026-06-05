"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, MessageCircle, Send, Shirt, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VestiaireChannel, VestiaireMessage } from "@/lib/supabase/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function channelIcon(channel: VestiaireChannel) {
  if (channel.type === "team") return Shirt;
  if (channel.is_private) return Lock;
  return Users;
}

export default function VestiairePage() {
  const [channels, setChannels] = useState<VestiaireChannel[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [messages, setMessages] = useState<VestiaireMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
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

  return (
    <div className="px-4 py-4 max-w-4xl mx-auto space-y-5">
      <header>
        <div className="flex items-center gap-2">
          <MessageCircle size={21} className="text-canal-yellow" />
          <h1 className="canal-headline text-2xl">Vestiaire</h1>
        </div>
        <p className="text-sm text-canal-gray-muted mt-1">
          Le groupe de discussion Canal Cup. Humains uniquement.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          {loading && <div className="canal-card text-canal-gray-muted text-sm">Chargement...</div>}
          {channels.map((channel) => {
            const Icon = channelIcon(channel);
            const active = channel.id === activeChannel?.id;
            return (
              <button
                key={channel.id}
                onClick={() => setActiveId(channel.id)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                  active
                    ? "border-canal-yellow bg-canal-yellow/10"
                    : "border-canal-gray-light bg-canal-gray hover:bg-canal-gray-mid"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} className={active ? "text-canal-yellow" : "text-canal-gray-muted"} />
                  <span className="font-black text-sm text-white truncate">{channel.title}</span>
                  {channel.is_private && <Lock size={12} className="text-canal-yellow ml-auto" />}
                </div>
                {channel.description && (
                  <p className="text-xs text-canal-gray-muted mt-1 line-clamp-2">{channel.description}</p>
                )}
              </button>
            );
          })}
        </aside>

        <section className="canal-card min-h-[520px] flex flex-col">
          <div className="border-b border-canal-gray-light pb-3 mb-3">
            <p className="text-white font-black">{activeChannel?.title ?? "Aucun salon"}</p>
            <p className="text-xs text-canal-gray-muted mt-1">
              {activeChannel?.is_private ? "Salon prive d'equipe" : "Salon public Canal Cup"}
            </p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map((message) => {
              const author = message.display_name ?? message.email ?? "Supporter";
              return (
                <div key={message.id} className="rounded-xl bg-canal-gray-mid border border-canal-gray-light px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-white text-sm">{author}</span>
                    <span className="text-xs text-canal-gray-muted">{formatTime(message.created_at)}</span>
                  </div>
                  <p className="text-sm text-canal-gray-light mt-1 whitespace-pre-wrap">{message.body}</p>
                </div>
              );
            })}
            {!loading && messages.length === 0 && (
              <div className="h-full min-h-[260px] flex items-center justify-center text-center">
                <div>
                  <MessageCircle size={32} className="mx-auto mb-2 text-canal-gray-muted" />
                  <p className="font-bold text-white">Ce salon est calme.</p>
                  <p className="text-sm text-canal-gray-muted mt-1">Un 2-0 annonce trop tot peut suffire.</p>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={submit} className="pt-3 mt-3 border-t border-canal-gray-light">
            <div className="flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message de vestiaire..."
                maxLength={1000}
                className="min-w-0 flex-1 rounded-xl border border-canal-gray-light bg-canal-gray-mid px-4 py-3 text-sm text-white placeholder:text-canal-gray-muted focus:outline-none focus:border-canal-yellow"
              />
              <button
                type="submit"
                disabled={sending || body.trim().length < 3 || !activeChannel}
                className="rounded-xl bg-canal-yellow px-4 py-3 text-canal-black font-black disabled:opacity-50"
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
