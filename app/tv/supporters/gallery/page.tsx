"use client";

// Écran TV salon — Galerie Journée Supporters. Plein écran, AUCUN bouton :
//  défilement auto des photos, binôme/titre, réactions, commentaires drôles,
//  + splash « Nouvelle participation » quand une photo vient d'être publiée.
//  Public (cf. middleware /tv). Lit /api/tv/supporters (sans auth).

import { useEffect, useMemo, useRef, useState } from "react";

interface Cmt { display_name: string; body: string }
interface Photo {
  id: string; team_name: string; title: string | null;
  photo_url: string; photo_url_2: string | null;
  media_type: string; media_type_2: string | null;
  reactions: Record<string, number>; comments: Cmt[]; created_at: string;
}
interface Data { photos: Photo[] }

const SLIDE_MS = 10000;
const SPLASH_MS = 6000;

const isVideoUrl = (u: string) => /\.(mp4|webm|mov)(\?|$)/i.test(u);
function TvMedia({ url, className }: { url: string; className: string }) {
  if (isVideoUrl(url)) return <video src={url} className={className} autoPlay muted loop playsInline />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={className} />;
}

export default function TvSupportersGalleryPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [idx, setIdx] = useState(0);
  const [splash, setSplash] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  useEffect(() => {
    const load = () =>
      fetch("/api/tv/supporters")
        .then((r) => r.json())
        .then((d: Data) => {
          if (!d || !Array.isArray(d.photos)) return;
          setPhotos(d.photos);
          if (!seeded.current) {
            for (const p of d.photos) seen.current.add(p.id);
            seeded.current = true;
          } else {
            const fresh = d.photos.find((p) => !seen.current.has(p.id));
            if (fresh) setSplash(fresh.team_name);
            for (const p of d.photos) seen.current.add(p.id);
          }
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  // Slides : photo principale puis bonus, par binôme.
  const slides = useMemo(() => {
    const out: { p: Photo; url: string; bonus: boolean }[] = [];
    for (const p of photos) {
      out.push({ p, url: p.photo_url, bonus: false });
      if (p.photo_url_2) out.push({ p, url: p.photo_url_2, bonus: true });
    }
    return out;
  }, [photos]);

  const n = slides.length;

  // Défilement auto (en pause pendant un splash).
  useEffect(() => {
    if (splash || n <= 1) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % n), SLIDE_MS);
    return () => clearTimeout(t);
  }, [splash, idx, n]);

  // Disparition du splash.
  useEffect(() => {
    if (!splash) return;
    const t = setTimeout(() => setSplash(null), SPLASH_MS);
    return () => clearTimeout(t);
  }, [splash]);

  if (!n) {
    return <div className="w-full min-h-screen bg-canal-black flex items-center justify-center text-canal-gray-muted text-3xl">Galerie Supporters…</div>;
  }

  const cur = slides[idx % n];
  const p = cur.p;

  return (
    <div className="w-full min-h-screen bg-canal-black text-white overflow-hidden relative flex flex-col items-center justify-center">
      {/* Progression */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
        {slides.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i === idx % n ? "bg-canal-yellow" : "bg-white/15"}`} />
        ))}
      </div>

      {/* Photo plein cadre */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <TvMedia url={cur.url} className="max-h-[78vh] max-w-[92vw] rounded-3xl object-contain shadow-[0_0_80px_rgba(0,0,0,0.7)]" />
      </div>

      {/* Bandeau bas : binôme, titre, réactions, commentaires */}
      <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-12 pb-10 pt-24">
        <div className="flex items-end justify-between gap-8">
          <div className="min-w-0">
            <h2 className="canal-headline text-6xl mb-1">{p.team_name}</h2>
            {p.title && <p className="text-3xl text-white/80">« {p.title} »</p>}
            {cur.bonus && <p className="text-xl text-canal-yellow/80 mt-1">📷 Photo bonus</p>}
          </div>
          <div className="flex items-center gap-6 text-4xl shrink-0">
            {Object.entries(p.reactions).map(([e, c]) => (
              <span key={e} className="flex items-center gap-2"><span>{e}</span><span className="font-black text-canal-yellow tabular-nums">{c}</span></span>
            ))}
          </div>
        </div>

        {/* Commentaires drôles */}
        {p.comments.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-x-10 gap-y-2">
            {p.comments.slice(0, 2).map((c, i) => (
              <p key={i} className="text-2xl text-white/85">
                <span className="text-canal-yellow font-black">{c.display_name}</span> <span className="italic">« {c.body} »</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Splash « Nouvelle participation » */}
      {splash && (
        <div className="absolute inset-0 z-40 bg-canal-black/95 flex flex-col items-center justify-center text-center gap-6 animate-pulse">
          <p className="text-5xl text-canal-yellow font-black uppercase tracking-widest">📸 Nouvelle participation</p>
          <p className="canal-headline text-8xl">{splash}</p>
          <p className="text-3xl text-white/70">vient de publier sa photo !</p>
        </div>
      )}
    </div>
  );
}
