"use client";

// Mur « Moments CanalCup » — mémoire collective de l'événement. Tout le monde
// poste (binôme ou non), avec une catégorie. AUCUN vote, AUCUN classement.
// Réactions + commentaires. Indépendant du concours Supporters.

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, RefreshCw, Send, X, MessageCircle, Trash2 } from "lucide-react";
import { MOMENT_CATEGORIES, MOMENT_REACTIONS, categoryMeta } from "@/lib/moments/categories";

type Media = "image" | "video";
interface Cmt { id: string; user_id: string | null; display_name: string; body: string; created_at: string }
interface Moment {
  id: string; source: "moment" | "supporters"; author_name: string; title: string | null; category: string;
  photo_url: string; media_type: Media; created_at: string; is_mine: boolean;
  reactions: Record<string, number>; my_reactions: string[]; comments: Cmt[];
}
interface Data { me: { userId: string }; isOrganizer: boolean; moments: Moment[] }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

function Media({ url, type, className, onZoom }: { url: string; type: Media; className?: string; onZoom?: () => void }) {
  if (type === "video") return <video src={url} className={className} controls playsInline preload="metadata" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={`${className ?? ""}${onZoom ? " cursor-zoom-in" : ""}`} onClick={onZoom} />;
}

export function MomentsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("fun");
  const [lightbox, setLightbox] = useState<{ url: string; type: Media } | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
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

  const hideSupporters = async (momentId: string) => {
    if (!confirm("Masquer cette photo du concours ? (modération concours)")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/supporters/moderate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "hide_photo", entry_id: momentId.replace(/^sup:/, "") }) });
      if (res.ok) load();
    } finally { setBusy(false); }
  };

  const toggleReact = (m: Moment, emoji: string) => {
    const cur = react[m.id] ?? { counts: { ...m.reactions }, mine: [...m.my_reactions] };
    const active = cur.mine.includes(emoji);
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
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button aria-label="Fermer" className="absolute top-4 right-4 text-white/80" onClick={() => setLightbox(null)}><X size={28} /></button>
          {lightbox.type === "video"
            ? <video src={lightbox.url} className="max-h-[90vh] max-w-full rounded-lg" controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={lightbox.url} alt="" className="max-h-[90vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />}
        </div>
      )}

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

      {/* Feed */}
      {data.moments.length === 0 && <p className="text-sm text-canal-gray-muted">Aucun moment {filter ? "dans cette catégorie" : "pour l'instant"}. Sois le premier 📸</p>}

      {data.moments.map((m) => {
        const rr = react[m.id] ?? { counts: m.reactions, mine: m.my_reactions };
        const cat = categoryMeta(m.category);
        const open = !!openComments[m.id];
        return (
          <article key={m.id} className="canal-card space-y-2">
            <Media url={m.photo_url} type={m.media_type} onZoom={() => setLightbox({ url: m.photo_url, type: m.media_type })} className="w-full rounded-lg object-contain max-h-80 bg-canal-black" />
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{m.author_name}{m.is_mine && <span className="text-canal-gray-muted font-normal"> · toi</span>}</p>
                {m.title && <p className="text-xs text-canal-gray-muted truncate">{m.title}</p>}
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-canal-gray-mid text-canal-gray-muted shrink-0">{cat.emoji} {cat.label}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-canal-gray-muted/60">{timeAgo(m.created_at)}</span>
              <div className="flex items-center gap-1">
                {m.source === "supporters"
                  ? data.isOrganizer && (
                      <button onClick={() => hideSupporters(m.id)} disabled={busy} className="text-canal-gray-muted hover:text-red-400 p-1" title="Masquer (concours)"><Trash2 size={14} /></button>
                    )
                  : (m.is_mine || data.isOrganizer) && (
                      <button onClick={() => moderate({ action: "delete_moment", moment_id: m.id }, "Supprimer ce moment ?")} disabled={busy} className="text-canal-gray-muted hover:text-red-400 p-1" title="Supprimer"><Trash2 size={14} /></button>
                    )}
              </div>
            </div>

            {/* Réactions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {m.source === "supporters" ? (
                <>
                  {Object.entries(rr.counts).filter(([, c]) => c > 0).map(([e, c]) => (
                    <span key={e} className="flex items-center gap-1 px-2 py-1 rounded-full text-base leading-none bg-canal-gray-mid"><span>{e}</span><span className="text-xs font-bold tabular-nums text-canal-gray-muted">{c}</span></span>
                  ))}
                  <a href="/supporters" className="text-[11px] text-canal-yellow font-bold hover:underline">🎭 Voter / réagir sur le concours →</a>
                </>
              ) : (
                MOMENT_REACTIONS.map((e) => {
                  const count = rr.counts[e] ?? 0;
                  const active = rr.mine.includes(e);
                  return (
                    <button key={e} onClick={() => toggleReact(m, e)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-base leading-none border transition-colors active:scale-95 ${active ? "bg-canal-yellow/20 border-canal-yellow/50" : "bg-canal-gray-mid border-transparent hover:border-canal-gray-light"}`}>
                      <span>{e}</span>
                      {count > 0 && <span className={`text-xs font-bold tabular-nums ${active ? "text-canal-yellow" : "text-canal-gray-muted"}`}>{count}</span>}
                    </button>
                  );
                })
              )}
              <button onClick={() => setOpenComments((p) => ({ ...p, [m.id]: !open }))} className="ml-auto flex items-center gap-1 text-xs text-canal-gray-muted hover:text-white px-2 py-1">
                <MessageCircle size={14} /> {m.comments.length}
              </button>
            </div>

            {/* Commentaires */}
            {open && (
              <div className="border-t border-canal-gray-light/20 pt-2 space-y-2">
                {m.comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-1.5 text-xs">
                    <span className="font-bold text-canal-yellow shrink-0">{c.display_name}</span>
                    <span className="text-canal-gray-light flex-1 break-words">{c.body}</span>
                    {m.source !== "supporters" && (data.isOrganizer || c.user_id === data.me.userId) && (
                      <button onClick={() => moderate({ action: "delete_comment", comment_id: c.id })} disabled={busy} className="text-canal-gray-muted hover:text-red-400 shrink-0"><X size={12} /></button>
                    )}
                  </div>
                ))}
                {m.source === "supporters" ? (
                  <a href="/supporters" className="text-xs text-canal-yellow font-bold hover:underline">💬 Commenter sur le concours →</a>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input value={commentText[m.id] ?? ""} onChange={(e) => setCommentText((p) => ({ ...p, [m.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(m.id); } }}
                      placeholder="Un petit mot…" maxLength={280}
                      className="flex-1 bg-canal-black border border-canal-gray-light rounded-lg px-2 py-1.5 text-xs" />
                    <button onClick={() => postComment(m.id)} disabled={busy || !(commentText[m.id] ?? "").trim()} className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-canal-gray-light text-white disabled:opacity-40 flex items-center gap-1" aria-label="Envoyer"><Send size={13} /></button>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
