"use client";

// Galerie plein écran Journée Supporters — 1 photo à la fois, immersif.
//  Mode salon : défilement auto (12 s) + nav clavier/flèches.  Interactif :
//  réactions emoji, vote (1/joueur, pas son binôme), commentaires.  Réutilise
//  /api/supporters (lecture) + /vote + /reactions + /comments (écriture).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Play, Pause, Vote, Check, MessageCircle, Send, X } from "lucide-react";
import { SUPPORTERS_REACTIONS } from "@/lib/supporters/access";

type Media = "image" | "video";
interface Comment { id: string; display_name: string; body: string; created_at: string }
interface GalleryItem {
  id: string;
  team_name: string;
  title: string | null;
  photo_url: string;
  photo_url_2: string | null;
  is_mine: boolean;
  media_type: Media;
  media_type_2: Media | null;
  votes_count: number | null;
  comments: Comment[];
  reactions: Record<string, number>;
  my_reactions: string[];
}
interface Data {
  settings: { votes_open: boolean; results_published: boolean; votes_closed: boolean; close_at: string };
  me: { userId: string; teamId: string | null };
  myVote: { entry_id: string } | null;
  gallery: GalleryItem[];
}

function Slide({ url, type }: { url: string; type: Media }) {
  if (type === "video") return <video src={url} className="max-h-full max-w-full object-contain" controls autoPlay muted loop playsInline />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="max-h-full max-w-full object-contain" />;
}

export function SupportersGallery() {
  const [data, setData] = useState<Data | null>(null);
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);
  // Réactions optimistes locales, ré-amorcées à chaque chargement serveur.
  const [react, setReact] = useState<Record<string, { counts: Record<string, number>; mine: string[] }>>({});

  const load = useCallback(() => {
    fetch("/api/supporters").then((r) => r.json()).then((d) => { if (!d.error) setData(d); }).catch(() => {});
  }, []);
  useEffect(() => load(), [load]);
  // Rafraîchissement de fond (réactions/commentaires/votes des autres).
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 12000);
    return () => clearInterval(t);
  }, [load]);

  // Ré-amorce l'état des réactions quand les données serveur changent.
  useEffect(() => {
    if (!data) return;
    const next: Record<string, { counts: Record<string, number>; mine: string[] }> = {};
    for (const g of data.gallery) next[g.id] = { counts: { ...g.reactions }, mine: [...g.my_reactions] };
    setReact(next);
  }, [data]);

  // Slides = photo principale puis (si présente) photo bonus, par binôme.
  const slides = useMemo(() => {
    const out: { g: GalleryItem; url: string; type: Media; bonus: boolean }[] = [];
    for (const g of data?.gallery ?? []) {
      out.push({ g, url: g.photo_url, type: g.media_type, bonus: false });
      if (g.photo_url_2) out.push({ g, url: g.photo_url_2, type: g.media_type_2 ?? "image", bonus: true });
    }
    return out;
  }, [data]);

  const n = slides.length;
  const go = useCallback((delta: number) => setIdx((i) => (n ? (i + delta + n) % n : 0)), [n]);

  // Deep-link « rappel de vote » (QR de la TV) : ?photo=<entry_id> ouvre la
  // galerie directement sur cette photo pour voter. Appliqué une seule fois.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !n) return;
    const wanted = new URLSearchParams(window.location.search).get("photo");
    if (!wanted) { deepLinked.current = true; return; }
    const target = slides.findIndex((s) => s.g.id === wanted && !s.bonus);
    if (target >= 0) { setIdx(target); setAuto(false); }
    deepLinked.current = true;
  }, [n, slides]);

  // Défilement automatique (pause si commentaires ouverts).
  useEffect(() => {
    if (!auto || showComments || n <= 1) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % n), 12000);
    return () => clearTimeout(t);
  }, [auto, showComments, idx, n]);

  // Navigation clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") { e.preventDefault(); setAuto((a) => !a); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const idxRef = useRef(idx);
  idxRef.current = idx;

  if (!data) {
    return <div className="fixed inset-0 bg-canal-black flex items-center justify-center text-canal-gray-muted">Chargement…</div>;
  }
  if (!n) {
    return (
      <div className="fixed inset-0 bg-canal-black flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-2xl">📸</p>
        <p className="text-canal-gray-muted">Aucune photo publiée pour l&apos;instant.</p>
        <Link href="/supporters" className="text-canal-yellow text-sm font-bold">← Retour</Link>
      </div>
    );
  }

  const cur = slides[idx % n];
  const g = cur.g;
  const st = data.settings;
  const hasVoted = !!data.myVote;
  const votedThis = data.myVote?.entry_id === g.id;
  const canVote = st.votes_open && !st.results_published && !st.votes_closed && !hasVoted && !g.is_mine;
  const rr = react[g.id] ?? { counts: g.reactions, mine: g.my_reactions };

  const vote = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/supporters/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entry_id: g.id }) });
      if (res.ok) load();
    } finally { setBusy(false); }
  };

  const toggleReact = (emoji: string) => {
    const active = rr.mine.includes(emoji);
    setReact((prev) => {
      const c = prev[g.id] ?? { counts: { ...g.reactions }, mine: [...g.my_reactions] };
      return {
        ...prev,
        [g.id]: {
          counts: { ...c.counts, [emoji]: Math.max(0, (c.counts[emoji] ?? 0) + (active ? -1 : 1)) },
          mine: active ? c.mine.filter((e) => e !== emoji) : [...c.mine, emoji],
        },
      };
    });
    fetch("/api/supporters/reactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entry_id: g.id, emoji }) }).then(() => load()).catch(() => load());
  };

  const postComment = async () => {
    const t = commentText.trim();
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch("/api/supporters/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entry_id: g.id, body: t }) });
      if (res.ok) { setCommentText(""); load(); }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-canal-black text-white select-none overflow-hidden">
      {/* Barre haute : retour · compteur · play/pause */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <Link href="/supporters" className="text-white/80 hover:text-white flex items-center gap-1 text-sm"><ArrowLeft size={18} /> Retour</Link>
        <span className="text-sm font-bold tabular-nums text-white/90">Photo {(idx % n) + 1} / {n}</span>
        <button onClick={() => setAuto((a) => !a)} className="text-white/80 hover:text-white flex items-center gap-1 text-sm" aria-label={auto ? "Pause" : "Lecture"}>
          {auto ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>

      {/* Photo plein écran + zones de navigation latérales */}
      <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-6">
        <Slide url={cur.url} type={cur.type} />
      </div>
      {n > 1 && (
        <>
          <button onClick={() => go(-1)} className="absolute left-0 top-0 bottom-0 z-10 px-2 sm:px-4 flex items-center text-white/40 hover:text-white" aria-label="Précédent"><ChevronLeft size={40} /></button>
          <button onClick={() => go(1)} className="absolute right-0 top-0 bottom-0 z-10 px-2 sm:px-4 flex items-center text-white/40 hover:text-white" aria-label="Suivant"><ChevronRight size={40} /></button>
        </>
      )}

      {/* Barre de progression des slides */}
      <div className="absolute top-0 inset-x-0 z-30 flex gap-1 p-1.5">
        {slides.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i === idx % n ? "bg-canal-yellow" : "bg-white/20"}`} />
        ))}
      </div>

      {/* Panneau bas : infos + réactions + vote + commentaires */}
      <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pb-5 pt-12">
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xl font-black truncate">{g.team_name}{g.is_mine && <span className="text-white/60 font-normal text-base"> · ton binôme</span>}</p>
              {g.title && <p className="text-sm text-white/80 truncate">« {g.title} »</p>}
              {cur.bonus && <p className="text-[11px] text-canal-yellow/80 mt-0.5">📷 Photo bonus</p>}
            </div>
            {g.votes_count != null && <span className="text-sm text-purple-300 font-bold shrink-0">{g.votes_count} 🗳️</span>}
          </div>

          {/* Réactions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {SUPPORTERS_REACTIONS.map((e) => {
              const count = rr.counts[e] ?? 0;
              const active = rr.mine.includes(e);
              return (
                <button key={e} onClick={() => toggleReact(e)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-lg leading-none border transition-colors active:scale-95 ${active ? "bg-canal-yellow/25 border-canal-yellow/60" : "bg-white/10 border-transparent hover:border-white/30"}`}>
                  <span>{e}</span>
                  {count > 0 && <span className={`text-xs font-bold tabular-nums ${active ? "text-canal-yellow" : "text-white/70"}`}>{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Vote + commentaires */}
          <div className="flex items-center gap-2">
            {canVote ? (
              <button onClick={vote} disabled={busy} className="flex-1 text-sm font-bold px-3 py-2.5 rounded-lg bg-purple-600 text-white disabled:opacity-50 flex items-center justify-center gap-2">
                <Vote size={16} /> Voter pour cette photo
              </button>
            ) : votedThis ? (
              <span className="flex-1 text-sm font-bold px-3 py-2.5 rounded-lg bg-green-600/20 text-green-300 flex items-center justify-center gap-2"><Check size={16} /> Ton vote</span>
            ) : g.is_mine ? (
              <span className="flex-1 text-xs text-white/50 text-center py-2.5">Pas de vote pour ton propre binôme.</span>
            ) : hasVoted ? (
              <span className="flex-1 text-xs text-white/50 text-center py-2.5">Tu as déjà voté (1 vote par joueur).</span>
            ) : (
              <span className="flex-1 text-xs text-white/50 text-center py-2.5">Votes fermés.</span>
            )}
            <button onClick={() => { setShowComments((s) => !s); setAuto(false); }} className="text-sm font-bold px-3 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 flex items-center gap-1.5">
              <MessageCircle size={16} /> {g.comments.length}
            </button>
          </div>
        </div>
      </div>

      {/* Panneau commentaires (slide-up) */}
      {showComments && (
        <div className="absolute inset-0 z-40 bg-black/80 flex flex-col" onClick={() => setShowComments(false)}>
          <div className="mt-auto bg-canal-gray-mid rounded-t-2xl p-4 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-canal-yellow">💬 Commentaires · {g.team_name}</p>
              <button onClick={() => setShowComments(false)} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {g.comments.length === 0 && <p className="text-sm text-white/50">Sois le premier à commenter 😏</p>}
              {g.comments.map((c) => (
                <div key={c.id} className="flex items-start gap-1.5 text-sm">
                  <span className="font-bold text-canal-yellow shrink-0">{c.display_name}</span>
                  <span className="text-white/85 flex-1 break-words">{c.body}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input value={commentText} onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                placeholder="Un petit mot, un chambrage…" maxLength={280}
                className="flex-1 bg-canal-black border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white placeholder:text-canal-gray-muted" />
              <button onClick={postComment} disabled={busy || !commentText.trim()} className="text-sm font-bold px-3 py-2 rounded-lg bg-canal-yellow text-canal-black disabled:opacity-40 flex items-center gap-1" aria-label="Envoyer">
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
