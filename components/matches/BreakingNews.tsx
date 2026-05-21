"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

interface NewsItem {
  text: string;
  sub?: string;
  type: string;
  at: string;
}

export function BreakingNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const fetch_ = () => {
      fetch("/api/breaking-news")
        .then((r) => r.json())
        .then((d) => { if (d.news?.length) setNews(d.news); })
        .catch(() => {});
    };
    fetch_();
    const t = setInterval(fetch_, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (news.length <= 1) return;
    const t = setInterval(() => setCurrent((i) => (i + 1) % news.length), 5_000);
    return () => clearInterval(t);
  }, [news.length]);

  if (!news.length) return null;

  const item = news[current];
  const isLive = item.type === "live";

  // Bandeau discret : fond identique pour live et flash (juste un fond
  // canal-gray sobre), seul l'identifiant à gauche colore (point rouge
  // pulsé pour live, éclair jaune pour flash). Beaucoup plus calme
  // qu'un grand fond rouge agressif en haut de toutes les pages.
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] overflow-hidden bg-canal-gray border-b border-canal-gray-light">
      <div className={`shrink-0 flex items-center gap-1 font-black uppercase tracking-wider ${
        isLive ? "text-red-400" : "text-canal-yellow"
      }`}>
        {isLive ? <span className="live-dot" /> : <Zap size={10} />}
        {isLive ? "Live" : "Flash"}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="font-bold truncate text-white">
          {item.text}
        </p>
        {item.sub && (
          <p className="text-canal-gray-muted truncate text-[10px]">{item.sub}</p>
        )}
      </div>
      {news.length > 1 && (
        <div className="flex gap-1 shrink-0" aria-label={`Notification ${current + 1} sur ${news.length}`}>
          {news.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Voir notification ${i + 1}`}
              className={`w-1 h-1 rounded-full transition-colors ${
                i === current ? "bg-canal-yellow" : "bg-canal-gray-light"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
