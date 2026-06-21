"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchComment {
  id: string;
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  body: string;
  created_at: string;
}

interface MatchCommentsResponse {
  messages: MatchComment[];
  total: number;
  unread: number;
}

interface Props {
  matchId: string;
  isLive?: boolean;
  onUnreadChange?: (count: number) => void;
}

function authorLabel(comment: MatchComment) {
  return comment.display_name || comment.email?.split("@")[0] || "Joueur Canal Cup";
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function MatchComments({ matchId, isLive, onUnreadChange }: Props) {
  const [messages, setMessages] = useState<MatchComment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}/comments?mark_read=1`, {
        credentials: "same-origin",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Impossible de charger les commentaires.");
      const data = payload as MatchCommentsResponse;
      setMessages(data.messages);
      onUnreadChange?.(0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les commentaires.");
    } finally {
      setLoading(false);
    }
  }, [matchId, onUnreadChange]);

  useEffect(() => {
    load();
    if (!isLive) return;
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [isLive, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ body }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Impossible d'envoyer le message.");
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="py-3 space-y-3">
      <div className="rounded-xl bg-canal-gray border border-canal-gray-light overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-canal-gray-light">
          <MessageCircle size={14} className="text-canal-yellow" />
          <span className="text-xs font-black text-canal-yellow uppercase tracking-wider">
            Discussion du match
          </span>
          <span className="ml-auto text-[11px] text-canal-gray-muted">
            {messages.length} message{messages.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="max-h-[48vh] overflow-y-auto px-3 py-3 space-y-2">
          {loading && (
            <p className="text-center text-canal-gray-muted text-sm py-8">Chargement...</p>
          )}

          {!loading && messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">💬</p>
              <p className="text-sm font-bold text-white">Aucun commentaire pour l'instant.</p>
              <p className="text-xs text-canal-gray-muted mt-1">Lance le débat sur le match.</p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="rounded-xl bg-canal-gray-mid px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                {message.user_id ? (
                  <Link href={`/joueur/${message.user_id}`} className="min-w-0 truncate text-xs font-black text-white hover:text-canal-yellow transition-colors">
                    {authorLabel(message)}
                  </Link>
                ) : (
                  <span className="min-w-0 truncate text-xs font-black text-white">{authorLabel(message)}</span>
                )}
                <span className="ml-auto shrink-0 text-[11px] text-canal-gray-muted">
                  {timeLabel(message.created_at)}
                </span>
              </div>
              <p className="text-sm text-white leading-snug whitespace-pre-wrap break-words">
                {message.body}
              </p>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex items-end gap-2 p-2 border-t border-canal-gray-light bg-canal-black/40">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={500}
            rows={1}
            placeholder="Réagir au match..."
            className="min-h-10 max-h-24 flex-1 resize-none rounded-lg bg-canal-black border border-canal-gray-light px-3 py-2 text-sm text-white placeholder:text-canal-gray-muted focus:outline-none focus:border-canal-yellow"
          />
          <button
            type="submit"
            disabled={sending || text.trim().length < 2}
            className={cn(
              "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors",
              sending || text.trim().length < 2
                ? "bg-canal-gray-mid text-canal-gray-muted"
                : "bg-canal-yellow text-canal-black hover:bg-canal-yellow-hover"
            )}
            aria-label="Envoyer"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {error && (
        <p className="text-xs text-red-400 px-1">{error}</p>
      )}
    </div>
  );
}
