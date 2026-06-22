"use client";

// Écran TV Journée Supporters — défilé automatique.
//  Avant reveal : photos + réactions (hype). Au reveal : cérémonie complète
//  (photos avec votes → Prix VAR → podium 🥉🥈🥇). Public (cf. middleware /tv).

import { useEffect, useMemo, useState } from "react";

interface Photo { id: string; team_name: string; title: string | null; photo_url: string; photo_url_2: string | null; reactions: Record<string, number>; votes: number | null }
interface Var { emoji: string; label: string; team_name: string; photo_url: string; count: number }
interface Podium { rank: number; team_name: string; title: string | null; photo_url: string; votes: number; points: number }
interface Data { revealed: boolean; photos: Photo[]; varAwards: Var[]; podium: Podium[] }

type Slide =
  | { type: "intro"; title: string; sub: string }
  | { type: "photo"; p: Photo }
  | { type: "var"; v: Var }
  | { type: "podium"; p: Podium };

const MEDAL = ["", "🥇", "🥈", "🥉"];
const SLIDE_MS = 8000;

const isVideoUrl = (u: string) => /\.(mp4|webm|mov)(\?|$)/i.test(u);
// Média plein cadre pour la TV (photo ou vidéo en autoplay muet bouclé).
function TvMedia({ url, className }: { url: string; className: string }) {
  if (isVideoUrl(url)) return <video src={url} className={className} autoPlay muted loop playsInline />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={className} />;
}

export default function TvSupportersPage() {
  const [data, setData] = useState<Data | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const load = () => fetch("/api/tv/supporters").then((r) => r.json()).then((d) => { if (!d.error) setData(d); }).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const slides = useMemo<Slide[]>(() => {
    if (!data) return [];
    const s: Slide[] = [];
    if (data.revealed) {
      s.push({ type: "intro", title: "🏆 Journée Supporters", sub: "Les résultats !" });
      data.photos.forEach((p) => s.push({ type: "photo", p }));
      data.varAwards.forEach((v) => s.push({ type: "var", v }));
      [...data.podium].sort((a, b) => b.rank - a.rank).forEach((p) => s.push({ type: "podium", p }));
    } else {
      s.push({ type: "intro", title: "📸 Journée Supporters", sub: "Votez pour votre photo préférée !" });
      data.photos.forEach((p) => s.push({ type: "photo", p }));
    }
    return s;
  }, [data]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) {
    return <div className="w-full min-h-screen bg-canal-black flex items-center justify-center text-canal-gray-muted text-3xl">Journée Supporters…</div>;
  }
  const slide = slides[idx % slides.length];

  return (
    <div className="w-full min-h-screen bg-canal-black text-white overflow-hidden flex flex-col items-center justify-center p-10 text-center relative">
      {/* progression */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 p-2">
        {slides.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i === idx % slides.length ? "bg-canal-yellow" : "bg-canal-gray-light/30"}`} />
        ))}
      </div>

      {slide.type === "intro" && (
        <>
          <h1 className="canal-headline text-8xl md:text-9xl mb-6">{slide.title}</h1>
          <p className="text-4xl text-canal-yellow font-black">{slide.sub}</p>
        </>
      )}

      {slide.type === "photo" && (
        <>
          {slide.p.photo_url_2 ? (
            <div className="flex gap-5 items-center justify-center mb-6 w-full">
              <TvMedia url={slide.p.photo_url} className="max-h-[55vh] max-w-[46%] rounded-3xl object-contain shadow-[0_0_60px_rgba(0,0,0,0.6)]" />
              <TvMedia url={slide.p.photo_url_2} className="max-h-[55vh] max-w-[46%] rounded-3xl object-contain shadow-[0_0_60px_rgba(0,0,0,0.6)]" />
            </div>
          ) : (
            <TvMedia url={slide.p.photo_url} className="max-h-[60vh] rounded-3xl object-contain mb-6 shadow-[0_0_60px_rgba(0,0,0,0.6)]" />
          )}
          <h2 className="canal-headline text-6xl mb-2">{slide.p.team_name}</h2>
          {slide.p.title && <p className="text-3xl text-white/80 mb-4">« {slide.p.title} »</p>}
          <div className="flex items-center gap-8 text-4xl mt-2">
            {Object.entries(slide.p.reactions).map(([e, n]) => (
              <span key={e} className="flex items-center gap-2"><span>{e}</span><span className="font-black text-canal-yellow tabular-nums">{n}</span></span>
            ))}
            {slide.p.votes != null && <span className="flex items-center gap-2">🗳️ <span className="font-black text-canal-yellow tabular-nums">{slide.p.votes}</span></span>}
          </div>
        </>
      )}

      {slide.type === "var" && (
        <>
          <p className="text-5xl text-canal-yellow font-black uppercase tracking-widest mb-6">🏆 Prix VAR</p>
          <div className="text-[10rem] leading-none mb-4">{slide.v.emoji}</div>
          <h2 className="canal-headline text-7xl mb-4">{slide.v.label}</h2>
          <TvMedia url={slide.v.photo_url} className="max-h-[35vh] rounded-3xl object-contain mb-5" />
          <p className="text-5xl font-black text-white">{slide.v.team_name}</p>
          <p className="text-2xl text-canal-gray-muted mt-2">{slide.v.count} {slide.v.label === "Photo la plus commentée" ? "commentaires" : "réactions"}</p>
        </>
      )}

      {slide.type === "podium" && (
        <>
          <div className="text-[12rem] leading-none mb-2">{MEDAL[slide.p.rank] ?? "🏅"}</div>
          <p className="text-4xl text-canal-yellow font-black uppercase tracking-widest mb-4">
            {slide.p.rank === 1 ? "La photo gagnante" : `${slide.p.rank}e place`}
          </p>
          <TvMedia url={slide.p.photo_url} className="max-h-[45vh] rounded-3xl object-contain mb-5 shadow-[0_0_60px_rgba(255,215,0,0.25)]" />
          <h2 className="canal-headline text-7xl">{slide.p.team_name}</h2>
          <p className="text-3xl text-canal-gray-muted mt-3">🗳️ {slide.p.votes} votes · +{slide.p.points} pts</p>
        </>
      )}
    </div>
  );
}
