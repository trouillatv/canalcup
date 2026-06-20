"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Swords, X, Search } from "lucide-react";

interface Hit { id: string; name: string; photo: string; teamName: string }

// Bouton ⚔️ Comparer → recherche un joueur → /football/players/[id]?vs=[autre].
export function ComparePicker({ currentId, currentName }: { currentId: string; currentName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) { setHits([]); return; }
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch(`/api/football/players/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setHits((d.players ?? []).filter((p: Hit) => p.id !== currentId)))
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, open, currentId]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-canal-gray-mid hover:bg-canal-gray-light text-white font-black text-sm transition-colors"
      >
        <Swords size={15} className="text-canal-yellow" /> Comparer
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-canal-black border border-canal-gray-light rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[80vh] overflow-y-auto m-0 sm:m-4">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 bg-canal-black border-b border-canal-gray-light">
              <span className="text-sm font-black text-white">Comparer {currentName} à…</span>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-canal-gray-muted hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 bg-canal-gray-mid rounded-xl px-3 py-2">
                <Search size={15} className="text-canal-gray-muted" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nom d'un joueur…"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                />
              </div>
              {loading && <p className="text-center text-canal-gray-muted text-xs py-4">Recherche…</p>}
              {!loading && q.trim().length >= 2 && !hits.length && (
                <p className="text-center text-canal-gray-muted text-xs py-4">Aucun joueur trouvé.</p>
              )}
              <div className="space-y-1">
                {hits.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => { setOpen(false); router.push(`/football/players/${currentId}?vs=${h.id}`); }}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-xl bg-canal-gray-mid hover:bg-canal-gray-light transition-colors text-left"
                  >
                    <img src={h.photo} alt={h.name} className="w-8 h-8 rounded-full object-cover bg-canal-gray-light" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-white truncate">{h.name}</span>
                      <span className="block text-[11px] text-canal-gray-muted truncate">{h.teamName}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
