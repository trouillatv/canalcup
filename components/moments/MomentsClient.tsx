"use client";

// Mur « Moments CanalCup » — mémoire collective de l'événement. Tout le monde
// poste (binôme ou non), avec une catégorie. AUCUN vote, AUCUN classement.
// Réactions + commentaires. Indépendant du concours Supporters.

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, RefreshCw, Send, X, MessageCircle, Trash2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { MOMENT_CATEGORIES, MOMENT_REACTIONS, categoryMeta } from "@/lib/moments/categories";

type Media = "image" | "video";
interface Cmt { id: string; user_id: string | null; display_name: string; body: string; created_at: string }
interface Moment {
  id: string; source: "moment" | "supporters"; author_name: string; title: string | null; category: string;
  photo_url: string; media_type: Media; created_at: string; is_mine: boolean;
  reactions: Record<string, number>; my_reactions: string[]; comments: Cmt[];
}
interface Data { me: { userId: string }; isOrganizer: boolean; hasVoted: boolean; moments: Moment[] }

export function MomentsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("fun");
  const [viewer, setViewer] = useState<number | null>(null);
  const [viewerComments, setViewerComments] = useState(false);
  const touchX = useRef<number | null>(null);
  const [floats, setFloats] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const floatId = useRef(0);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [react, setReact] = useState<Record<string, { counts: Record<string, number>; mine: string[] }>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const q = filter ? `?category=${filter}` : "";
    fetch(`/api/moments${q}`).then((r) => r.json()).then((d) => { if (!d.error) setData(d); }).catch(() => {});
  }, [filter]);
  useEffect(() => load(), [load]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!data) return;
    const next: Record<string, { counts: Record<string, number>; mine: string[] }> = {};
    for (const m of data.moments) next[m.id] = { counts: { ...m.reactions }, mine: [...m.my_reactions] };
    setReact(next);
  }, [data]);

  // Navigation clavier du viewer plein écran.
  useEffect(() => {
    if (viewer === null) return;
    const len = data?.moments.length ?? 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setViewer((v) => (v === null || !len ? v : (v + 1) % len));
      else if (e.key === "ArrowLeft") setViewer((v) => (v === null || !len ? v : (v - 1 + len) % len));
      else if (e.key === "Escape") setViewer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, data]);

  // Multi-photos : on poste chaque fichier sélectionné comme un Moment distinct.
  const uploadFiles = async (files: FileList) => {
    setBusy(true); setFlash(null);
    let ok = 0, fail = 0;
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", category);
        if (title.trim()) fd.append("title", title.trim());
        const res = await fetch("/api/moments/entry", { method: "POST", body: fd });
        if (res.ok) ok++; else fail++;
      }
      if (ok) { setTitle(""); load(); }
      setFlash(fail
        ? { kind: "err", msg: `${ok} publiée(s), ${fail} échec(s).` }
        : { kind: "ok", msg: `${ok} photo${ok > 1 ? "s" : ""} publiée${ok > 1 ? "s" : ""} ! 📸` });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Télécharger la photo (souvenir) — fetch blob pour forcer le download.
  const downloadPhoto = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (url.split("/").pop() || "moment").split("?")[0];
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
    } catch { window.open(url, "_blank"); }
  };

  const hideSupporters = async (momentId: string) => {
    if (!confirm("Masquer cette photo du concours ? (modération concours)")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/supporters/moderate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "hide_photo", entry_id: momentId.replace(/^sup:/, "") }) });
      if (res.ok) load();
    } finally { setBusy(false); }
  };

  // Emojis flottants qui remontent à l'écran (sensation de vie, façon Facebook).
  const spawnFloats = (emoji: string) => {
    const items = Array.from({ length: 6 }, () => ({ id: floatId.current++, emoji, x: 15 + Math.random() * 70 }));
    setFloats((f) => [...f, ...items]);
    const ids = new Set(items.map((it) => it.id));
    setTimeout(() => setFloats((f) => f.filter((x) => !ids.has(x.id))), 1600);
  };

  const toggleReact = (m: Moment, emoji: string) => {
    const cur = react[m.id] ?? { counts: { ...m.reactions }, mine: [...m.my_reactions] };
    const active = cur.mine.includes(emoji);
    if (!active) spawnFloats(emoji);
    setReact((prev) => ({
      ...prev,
      [m.id]: {
        counts: { ...cur.counts, [emoji]: Math.max(0, (cur.counts[emoji] ?? 0) + (active ? -1 : 1)) },
        mine: active ? cur.mine.filter((e) => e !== emoji) : [...cur.mine, emoji],
      },
    }));
    fetch("/api/moments/reactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moment_id: m.id, emoji }) }).then(() => load()).catch(() => load());
  };

  const postComment = async (momentId: string) => {
    const t = (commentText[momentId] ?? "").trim();
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch("/api/moments/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moment_id: momentId, body: t }) });
      if (res.ok) { setCommentText((p) => ({ ...p, [momentId]: "" })); load(); }
    } finally { setBusy(false); }
  };

  const moderate = async (payload: Record<string, string>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/moments/moderate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) load();
    } finally { setBusy(false); }
  };

  if (!data) return <div className="text-canal-gray-muted text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Chargement…</div>;

  return (
    <div className="space-y-5">
      {/* Viewer plein écran navigable (← → · swipe · clavier) — façon Google Photos */}
      {viewer !== null && data.moments[viewer] && (() => {
        const m = data.moments[viewer];
        const rr = react[m.id] ?? { counts: m.reactions, mine: m.my_reactions };
        const cat = categoryMeta(m.category);
        const len = data.moments.length;
        const go = (d: number) => { setViewerComments(false); setViewer((v) => (v === null ? v : (v + d + len) % len)); };
        return (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => { if (touchX.current === null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touchX.current = null; }}>
            <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
              <span className="text-sm font-bold text-white/90 tabular-nums">{viewer + 1} / {len}</span>
              <div className="flex items-center gap-4">
                <button onClick={() => downloadPhoto(m.photo_url)} className="text-white/80 hover:text-white flex items-center gap-1 text-sm" aria-label="Télécharger"><Download size={20} /> <span className="hidden sm:inline">Télécharger</span></button>
                {((m.source !== "supporters" && (m.is_mine || data.isOrganizer)) || (m.source === "supporters" && data.isOrganizer)) && (
                  <button onClick={async () => {
                    if (m.source === "supporters") await hideSupporters(m.id);
                    else await moderate({ action: "delete_moment", moment_id: m.id }, "Supprimer ce moment ?");
                    setViewer(null); setViewerComments(false);
                  }} className="text-white/80 hover:text-red-400" aria-label="Supprimer"><Trash2 size={20} /></button>
                )}
                <button onClick={() => { setViewer(null); setViewerComments(false); }} className="text-white/80 hover:text-white" aria-label="Fermer"><X size={26} /></button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-2">
              {m.media_type === "video"
                ? <video src={m.photo_url} className="max-h-full max-w-full object-contain" controls autoPlay playsInline />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={m.photo_url} alt="" className="max-h-full max-w-full object-contain" />}
            </div>
            {floats.length > 0 && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
                {floats.map((f) => (
                  <span key={f.id} className="absolute bottom-28 text-5xl animate-float-up" style={{ left: `${f.x}%` }}>{f.emoji}</span>
                ))}
              </div>
            )}
            {len > 1 && (
              <>
                <button onClick={() => go(-1)} className="absolute left-0 top-0 bottom-0 px-2 sm:px-4 flex items-center text-white/40 hover:text-white" aria-label="Précédent"><ChevronLeft size={40} /></button>
                <button onClick={() => go(1)} className="absolute right-0 top-0 bottom-0 px-2 sm:px-4 flex items-center text-white/40 hover:text-white" aria-label="Suivant"><ChevronRight size={40} /></button>
              </>
            )}
            <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/85 to-transparent px-4 pb-6 pt-12">
              <div className="max-w-xl mx-auto space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-white truncate">{m.author_name}</p>
                    {m.title && <p className="text-sm text-white/80 truncate">« {m.title} »</p>}
                    <p className="text-[11px] text-white/45">{new Date(m.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/15 text-white shrink-0">{cat.emoji} {cat.label}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {m.source === "supporters" ? (
                    <>
                      {Object.entries(rr.counts).filter(([, c]) => c > 0).map(([e, c]) => (
                        <span key={e} className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-lg leading-none"><span>{e}</span><span className="text-xs font-bold text-white/70">{c}</span></span>
                      ))}
                      <a href="/supporters" className="text-[11px] text-canal-yellow font-bold">🎭 Concours →</a>
                    </>
                  ) : (
                    MOMENT_REACTIONS.map((e) => {
                      const count = rr.counts[e] ?? 0;
                      const active = rr.mine.includes(e);
                      return (
                        <button key={e} onClick={() => toggleReact(m, e)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-lg leading-none border ${active ? "bg-canal-yellow/25 border-canal-yellow/60" : "bg-white/10 border-transparent"}`}>
                          <span>{e}</span>{count > 0 && <span className={`text-xs font-bold ${active ? "text-canal-yellow" : "text-white/70"}`}>{count}</span>}
                        </button>
                      );
                    })
                  )}
                </div>
                <button onClick={() => setViewerComments((s) => !s)} className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
                  <MessageCircle size={16} /> {m.comments.length} commentaire{m.comments.length > 1 ? "s" : ""}
                </button>
                {viewerComments && (
                  <div className="bg-white/5 rounded-xl p-3 max-h-[35vh] overflow-y-auto space-y-2">
                    {m.comments.length === 0 && <p className="text-xs text-white/50">Aucun commentaire.</p>}
                    {m.comments.map((c) => (
                      <div key={c.id} className="flex items-start gap-1.5 text-sm">
                        <span className="font-bold text-canal-yellow shrink-0">{c.display_name}</span>
                        <span className="text-white/85 flex-1 break-words">{c.body}</span>
                      </div>
                    ))}
                    {m.source === "supporters" ? (
                      <a href="/supporters" className="text-xs text-canal-yellow font-bold">💬 Commenter sur le concours →</a>
                    ) : (
                      <div className="flex items-center gap-1.5 pt-1">
                        <input value={commentText[m.id] ?? ""} onChange={(e) => setCommentText((p) => ({ ...p, [m.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(m.id); } }}
                          placeholder="Un petit mot…" maxLength={280}
                          className="flex-1 bg-canal-black border border-canal-gray-light rounded-lg px-2 py-1.5 text-xs" />
                        <button onClick={() => postComment(m.id)} disabled={busy || !(commentText[m.id] ?? "").trim()} className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-canal-yellow text-canal-black disabled:opacity-40 flex items-center gap-1" aria-label="Envoyer"><Send size={13} /></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {flash && (
        <div className={`text-sm rounded-lg p-3 ${flash.kind === "ok" ? "bg-green-950/30 text-green-300 border border-green-500/30" : "bg-red-950/30 text-red-300 border border-red-500/30"}`}>{flash.msg}</div>
      )}

      {/* Poster */}
      <section className="canal-card space-y-3">
        <h2 className="text-xs text-canal-yellow font-bold uppercase">Partager un moment</h2>
        <div className="flex flex-wrap gap-1.5">
          {MOMENT_CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${category === c.key ? "bg-canal-yellow text-canal-black border-canal-yellow" : "bg-canal-gray-mid border-transparent text-canal-gray-muted hover:border-canal-gray-light"}`}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Légende (optionnel)" maxLength={120}
          className="w-full bg-canal-black border border-canal-gray-light rounded-lg px-2 py-2 text-sm" />
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden"
          onChange={(e) => { const fs = e.currentTarget.files; if (fs && fs.length) uploadFiles(fs); }} />
        <button disabled={busy} onClick={() => fileRef.current?.click()}
          className="w-full text-sm font-bold px-3 py-2.5 rounded-lg bg-canal-yellow text-canal-black disabled:opacity-50 flex items-center justify-center gap-2">
          <Upload size={15} /> {busy ? "Envoi…" : "Publier une ou plusieurs photos"}
        </button>
        <p className="text-[11px] text-canal-gray-muted/70">Tout le monde peut publier (même sans binôme). Aucun vote, aucun classement — juste la vie de CanalCup.</p>
      </section>

      {/* Filtres */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter(null)} className={`px-2.5 py-1 rounded-full text-xs font-bold ${filter === null ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-canal-gray-muted"}`}>Tout</button>
        {MOMENT_CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setFilter(c.key)} className={`px-2.5 py-1 rounded-full text-xs font-bold ${filter === c.key ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-canal-gray-muted"}`}>{c.emoji} {c.label}</button>
        ))}
      </div>

      {/* Feed / Galerie */}
      {data.moments.length === 0 && <p className="text-sm text-canal-gray-muted">Aucun moment {filter ? "dans cette catégorie" : "pour l'instant"}. Sois le premier 📸</p>}

      {/* Galerie : grille de vignettes (clic → plein écran) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
          {data.moments.map((m, i) => (
            <button key={m.id} onClick={() => setViewer(i)} className="relative aspect-square overflow-hidden rounded-md bg-canal-black">
              {m.media_type === "video"
                ? <video src={m.photo_url} className="w-full h-full object-cover" muted playsInline />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={m.photo_url} alt="" className="w-full h-full object-cover" />}
              {Object.entries(m.reactions).filter(([, c]) => c > 0).length > 0 && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5 flex items-center gap-1">
                  {Object.entries(m.reactions).filter(([, c]) => c > 0).slice(0, 3).map(([e, c]) => (
                    <span key={e} className="text-[10px] text-white font-bold leading-none">{e}{c}</span>
                  ))}
                </div>
              )}
              {m.media_type === "video" && <span className="absolute top-1 right-1 text-xs">🎬</span>}
            </button>
          ))}
        </div>
    </div>
  );
}
