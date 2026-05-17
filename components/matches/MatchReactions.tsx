"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const EMOJIS = ["⚽", "🔥", "😱", "🤩", "😡", "🎉"] as const;

interface Props {
  matchId: string;
  isLive?: boolean;
}

interface ReactionsData {
  counts: Record<string, number>;
  mine: string[];
  total: number;
}

export function MatchReactions({ matchId, isLive }: Props) {
  const [data, setData] = useState<ReactionsData>({ counts: {}, mine: [], total: 0 });
  const [loading, setLoading] = useState<string | null>(null);

  const fetchReactions = useCallback(() => {
    fetch(`/api/matches/${matchId}/reactions`)
      .then((r) => r.json())
      .then((d: ReactionsData) => setData(d))
      .catch(() => {});
  }, [matchId]);

  useEffect(() => {
    fetchReactions();
    if (!isLive) return;
    const t = setInterval(fetchReactions, 15_000);
    return () => clearInterval(t);
  }, [fetchReactions, isLive]);

  const toggle = async (emoji: string) => {
    if (loading) return;
    setLoading(emoji);

    // Optimistic update
    const isMine = data.mine.includes(emoji);
    setData((prev) => ({
      counts: {
        ...prev.counts,
        [emoji]: Math.max(0, (prev.counts[emoji] ?? 0) + (isMine ? -1 : 1)),
      },
      mine: isMine ? prev.mine.filter((e) => e !== emoji) : [...prev.mine, emoji],
      total: prev.total + (isMine ? -1 : 1),
    }));

    await fetch(`/api/matches/${matchId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });

    setLoading(null);
    fetchReactions();
  };

  const topReaction = EMOJIS.reduce(
    (top, e) => (data.counts[e] ?? 0) > (data.counts[top] ?? 0) ? e : top,
    EMOJIS[0]
  );

  return (
    <div className="px-4 py-3 space-y-2">
      {data.total > 0 && (
        <p className="text-xs text-canal-gray-muted text-center">
          {data.total} réaction{data.total > 1 ? "s" : ""} — ambiance{" "}
          <span>{topReaction}</span>
        </p>
      )}
      <div className="flex justify-center gap-2">
        {EMOJIS.map((emoji) => {
          const count = data.counts[emoji] ?? 0;
          const active = data.mine.includes(emoji);
          return (
            <button
              key={emoji}
              onClick={() => toggle(emoji)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all duration-150 text-xl",
                active
                  ? "bg-canal-yellow/20 border border-canal-yellow/50 scale-110"
                  : "bg-canal-gray border border-canal-gray-light hover:bg-canal-gray-mid active:scale-95"
              )}
            >
              <span>{emoji}</span>
              {count > 0 && (
                <span className={cn("text-xs font-black leading-none", active ? "text-canal-yellow" : "text-canal-gray-muted")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
