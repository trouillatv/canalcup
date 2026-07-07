"use client";

import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";

interface NewsItem {
  text: string;
  sub?: string;
  type: string;
  at: string;
}

// Cadence adaptative + auto-pause. Ce composant vit dans le layout racine :
// il tourne donc sur 100 % des pages pour chaque utilisateur. Poller à 30 s
// en continu (même onglet caché / PWA verrouillée / aucun match) était la
// première source de CPU/invocations Vercel. Désormais :
//  - onglet CACHÉ            → on ne poll pas du tout (reprise au retour),
//  - contenu chaud (live/but/coup d'envoi imminent) → 60 s,
//  - rien de sensible au temps (aucun match, ou "terminé") → 5 min.
const ACTIVE_MS = 60_000;
const IDLE_MS = 300_000;
// Types dont l'affichage bouge vite → justifient la cadence rapide. "finished"
// (résultat figé) et l'absence de news retombent en cadence lente.
const HOT_TYPES = new Set(["live", "goal", "halftime", "upcoming"]);

export function BreakingNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [current, setCurrent] = useState(0);

  // Boucle de polling auto-programmée (setTimeout, pas setInterval) : l'intervalle
  // suivant dépend du contenu reçu, et on saute complètement le tick quand l'onglet
  // est caché. Une visibilitychange "visible" relance un fetch immédiat.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, ms);
    };

    const tick = async () => {
      if (cancelled) return;
      // Onglet caché → on ne consomme rien. On repasse voir dans IDLE_MS au cas
      // où l'onglet resterait ouvert en arrière-plan (le retour au premier plan
      // déclenche de toute façon un fetch immédiat via onVisible).
      if (typeof document !== "undefined" && document.hidden) {
        schedule(IDLE_MS);
        return;
      }
      let items: NewsItem[] = [];
      try {
        const r = await fetch("/api/breaking-news");
        const d = await r.json();
        items = d.news ?? [];
      } catch {
        /* silencieux : on reprogramme quand même */
      }
      if (cancelled) return;
      setNews(items);
      const hot = items.some((n) => HOT_TYPES.has(n.type));
      schedule(hot ? ACTIVE_MS : IDLE_MS);
    };

    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) tick();
    };

    tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (news.length <= 1) return;
    const t = setInterval(() => setCurrent((i) => (i + 1) % news.length), 5_000);
    return () => clearInterval(t);
  }, [news.length]);

  if (!news.length) return null;

  // La liste peut rétrécir entre deux fetch (un match se termine) : on borne
  // l'index pour ne jamais lire un item hors limites.
  const item = news[current] ?? news[0];
  const isLive = item.type === "live";
  const isFinished = item.type === "finished";

  // Bandeau discret : fond identique pour live et flash (juste un fond
  // canal-gray sobre), seul l'identifiant à gauche colore (point rouge
  // pulsé pour live, éclair jaune pour flash). Beaucoup plus calme
  // qu'un grand fond rouge agressif en haut de toutes les pages.
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] overflow-hidden bg-canal-gray border-b border-canal-gray-light">
      <div className={`shrink-0 flex items-center gap-1 font-black uppercase tracking-wider ${
        isLive ? "text-red-400" : isFinished ? "text-canal-gray-muted" : "text-canal-yellow"
      }`}>
        {isLive ? <span className="live-dot" /> : isFinished ? "🏁" : <Zap size={10} />}
        {isLive ? "Live" : isFinished ? "Terminé" : "Flash"}
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
