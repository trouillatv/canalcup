"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Calendar, MessageCircle, Send, Sparkles, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type LiveKind = "system" | "colleague" | "robert" | "match" | "animation";

type LiveItem = {
  id: string;
  source: "feed" | "vestiaire";
  kind: LiveKind;
  title: string;
  author: string;
  body: string;
  created_at: string;
  reactions?: Record<string, number>;
  mine_reactions?: string[];
  reaction_count?: number;
};

const FILTERS: { id: "all" | LiveKind; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "colleague", label: "Collegues" },
  { id: "robert", label: "Le Goat" },
  { id: "match", label: "Matchs" },
  { id: "animation", label: "Animations" },
];

const REACTIONS = ["🔥", "😂", "👏", "😱"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cardTheme(kind: LiveKind) {
  if (kind === "robert") {
    return {
      icon: Bot,
      label: "Le Goat",
      shell: "border-canal-yellow/60 bg-canal-yellow text-canal-black",
      iconBox: "bg-canal-black text-canal-yellow",
      meta: "text-canal-black/65",
      body: "text-canal-black",
    };
  }
  if (kind === "colleague") {
    return {
      icon: MessageCircle,
      label: "Collegue",
      shell: "border-green-400/25 bg-green-950/20 text-white",
      iconBox: "bg-green-300/15 text-green-200 border border-green-300/25",
      meta: "text-green-100/60",
      body: "text-white",
    };
  }
  if (kind === "match") {
    return {
      icon: Calendar,
      label: "Match",
      shell: "border-sky-400/25 bg-sky-950/20 text-white",
      iconBox: "bg-sky-300/15 text-sky-200 border border-sky-300/25",
      meta: "text-sky-100/60",
      body: "text-white",
    };
  }
  if (kind === "animation") {
    return {
      icon: Sparkles,
      label: "Animation",
      shell: "border-fuchsia-400/25 bg-fuchsia-950/20 text-white",
      iconBox: "bg-fuchsia-300/15 text-fuchsia-200 border border-fuchsia-300/25",
      meta: "text-fuchsia-100/60",
      body: "text-white",
    };
  }
  return {
    icon: Trophy,
    label: "Systeme",
    shell: "border-canal-gray-light bg-canal-gray text-white",
    iconBox: "bg-canal-yellow/15 text-canal-yellow border border-canal-yellow/25",
    meta: "text-canal-gray-muted",
    body: "text-white",
  };
}

export default function LivePage() {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [filter, setFilter] = useState<"all" | LiveKind>("all");
  const [showGoat, setShowGoat] = useState(true);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [reacting, setReacting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (!showGoat && item.kind === "robert") return false;
        return filter === "all" || item.kind === filter;
      }),
    [items, filter, showGoat]
  );

  const fetchLive = async () => {
    const res = await fetch("/api/live", { cache: "no-store" });
    const data = await res.json();
    if (Array.isArray(data)) setItems(data);
  };

  useEffect(() => {
    fetchLive().finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setError("");
    const res = await fetch("/api/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Message impossible.");
      setPosting(false);
      return;
    }
    setBody("");
    await fetchLive();
    setPosting(false);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
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
    await fetchLive();
    setReacting(null);
  };

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto space-y-5">
      <header className="rounded-2xl border border-canal-yellow/25 bg-canal-yellow/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-canal-yellow text-canal-black flex items-center justify-center">
            <Sparkles size={21} />
          </div>
          <div>
            <h1 className="canal-headline text-2xl">Canal Cup Live</h1>
            <p className="text-sm text-canal-gray-muted mt-0.5">
              Evenements, collegues et Le Goat dans le meme flux.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                "shrink-0 min-h-10 rounded-xl border px-3 text-xs font-black transition-colors",
                filter === tab.id
                  ? "border-canal-yellow bg-canal-yellow text-canal-black"
                  : "border-canal-gray-light bg-canal-gray-mid text-canal-gray-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowGoat((v) => !v)}
          className={cn(
            "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black transition-colors",
            showGoat
              ? "border-canal-yellow/40 bg-canal-yellow/10 text-canal-yellow"
              : "border-canal-gray-light bg-canal-gray-mid text-canal-gray-muted"
          )}
        >
          <Bot size={15} />
          {showGoat ? "IA visible" : "IA masquee"}
        </button>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-green-400/20 bg-green-950/20 p-3 space-y-2">
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Balance un message dans le Live..."
            maxLength={1000}
            className="min-w-0 flex-1 rounded-xl border border-green-300/20 bg-canal-black/40 px-4 py-3 text-sm text-white placeholder:text-canal-gray-muted focus:outline-none focus:border-green-300"
          />
          <button
            type="submit"
            disabled={posting || body.trim().length < 3}
            className="min-h-11 min-w-11 rounded-xl bg-canal-yellow px-4 py-3 text-canal-black font-black disabled:opacity-50"
            aria-label="Envoyer"
          >
            <Send size={17} />
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      <div className="space-y-3">
        {loading && <div className="canal-card text-center py-8 text-canal-gray-muted">Chargement...</div>}
        {!loading && visibleItems.map((item) => {
          const theme = cardTheme(item.kind);
          const Icon = theme.icon;
          return (
            <article key={`${item.source}:${item.id}`} className={cn("rounded-2xl border px-3 py-3", theme.shell)}>
              <div className="flex items-start gap-3">
                <div className={cn("h-9 w-9 shrink-0 rounded-xl flex items-center justify-center", theme.iconBox)}>
                  <Icon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm">{item.kind === "colleague" ? item.author : item.title}</span>
                    <span className={cn("text-xs", theme.meta)}>{theme.label}</span>
                    <span className={cn("text-xs", theme.meta)}>{formatTime(item.created_at)}</span>
                    {(item.reaction_count ?? 0) > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-canal-yellow/30 bg-canal-yellow/15 px-2 py-0.5 text-[11px] font-black text-canal-yellow">
                        <Trophy size={11} />
                        +{item.reaction_count}
                      </span>
                    )}
                  </div>
                  <p className={cn("mt-2 text-[15px] leading-relaxed whitespace-pre-wrap", theme.body)}>{item.body}</p>

                  {item.source === "vestiaire" && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {REACTIONS.map((emoji) => {
                        const count = item.reactions?.[emoji] ?? 0;
                        const mine = item.mine_reactions?.includes(emoji) ?? false;
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(item.id, emoji)}
                            disabled={reacting === `${item.id}:${emoji}`}
                            className={cn(
                              "min-h-9 rounded-full border px-2.5 text-sm font-black transition-colors disabled:opacity-60",
                              mine
                                ? "border-canal-yellow bg-canal-yellow text-canal-black"
                                : "border-white/10 bg-black/20 text-white hover:border-canal-yellow/50"
                            )}
                          >
                            <span>{emoji}</span>
                            {count > 0 && <span className="ml-1 text-xs tabular-nums">{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {!loading && visibleItems.length === 0 && (
          <div className="canal-card text-center py-8">
            <Users size={32} className="mx-auto mb-2 text-canal-gray-muted" />
            <p className="font-bold text-white">Rien dans ce filtre.</p>
            <p className="text-sm text-canal-gray-muted mt-1">Change de filtre ou lance le premier message.</p>
          </div>
        )}
      </div>
    </div>
  );
}
