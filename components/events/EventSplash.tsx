"use client";

// 🎆 Splash événementiel CanalCup — annonce plein écran au lancement de l'app
// (prochain Quiz). Visible, joyeux, NON intrusif :
//  - s'affiche à CHAQUE (ré)ouverture de l'app, pas à chaque navigation interne ;
//  - se ferme pour la SESSION COURANTE seulement (sessionStorage) → réapparaît
//    à la prochaine ouverture ;
//  - ne s'affiche plus une fois la date passée (config.showUntil) ;
//  - animation légère (CSS pur : confettis + feux d'artifice), coupée en
//    `prefers-reduced-motion`.
// Config : lib/config/event-splash.ts (V1 statique).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { EVENT_SPLASH } from "@/lib/config/event-splash";

// Clé liée au contenu : changer `showUntil` (nouvelle annonce) refait apparaître
// le splash même si la session précédente l'avait fermé.
const SESSION_KEY = `cc-splash:${EVENT_SPLASH.showUntil}`;
const PALETTE = ["#FFD400", "#2563eb", "#7c3aed", "#f97316", "#22c55e", "#ec4899"];

export function EventSplash() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const c = EVENT_SPLASH;
    if (!c.enabled) return;
    if (c.showFrom && Date.now() < new Date(c.showFrom).getTime()) return; // pas encore la veille
    if (Date.now() > new Date(c.showUntil).getTime()) return; // date passée
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return; // déjà fermé cette session
    } catch {
      /* sessionStorage indispo → on affiche quand même */
    }
    setShow(true);
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const goQuiz = () => {
    dismiss();
    router.push(EVENT_SPLASH.primaryCta.href);
  };

  // Positions déterministes (index-based) → pas de coût Math.random par frame.
  const confetti = useMemo(
    () =>
      Array.from({ length: 38 }, (_, i) => ({
        left: (i * 53) % 100,
        delay: (i % 12) * 0.18,
        dur: 2.6 + (i % 5) * 0.45,
        color: PALETTE[i % PALETTE.length],
        size: 6 + (i % 4) * 3,
      })),
    []
  );
  const fireworks = useMemo(
    () =>
      [
        { left: 18, top: 22 }, { left: 78, top: 18 }, { left: 50, top: 12 },
        { left: 30, top: 40 }, { left: 70, top: 38 },
      ].map((f, i) => ({ ...f, color: PALETTE[i % PALETTE.length], delay: i * 0.45 })),
    []
  );

  if (!show) return null;
  const c = EVENT_SPLASH;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 select-none overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% -5%, #2A1E08 0%, #130F08 45%, #0A0906 100%)" }}
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
    >
      {/* 🎆 Feux d'artifice (CSS, coupés en reduced-motion) */}
      <div className="pointer-events-none absolute inset-0 motion-reduce:hidden" aria-hidden>
        {fireworks.map((f, i) => (
          <span
            key={`fw${i}`}
            className="absolute rounded-full"
            style={{
              left: `${f.left}%`,
              top: `${f.top}%`,
              width: 140,
              height: 140,
              marginLeft: -70,
              marginTop: -70,
              background: `radial-gradient(circle, ${f.color} 0%, ${f.color}55 35%, transparent 65%)`,
              animation: `fireworkBurst 1.5s ease-out ${f.delay}s infinite`,
            }}
          />
        ))}
        {/* 🎉 Confettis */}
        {confetti.map((p, i) => (
          <span
            key={`cf${i}`}
            className="absolute top-[-6%] rounded-sm"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 1.6,
              background: p.color,
              animation: `confettiFall ${p.dur}s linear ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Fermer (croix discrète) */}
      <button
        onClick={dismiss}
        aria-label="Fermer"
        className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/40 border border-white/15 flex items-center justify-center text-white/70 hover:text-white"
      >
        <X size={18} />
      </button>

      {/* Carte d'annonce */}
      <div
        className="relative w-full max-w-md rounded-3xl border border-canal-yellow/30 bg-canal-gray/80 backdrop-blur p-6 sm:p-8 text-center shadow-2xl"
        style={{ animation: "pop .5s ease-out both" }}
      >
        <div className="text-5xl sm:text-6xl mb-2" style={{ animation: "fadeUp .5s both" }}>
          {c.emoji}
        </div>
        <h2 className="font-black text-2xl sm:text-3xl text-canal-yellow uppercase tracking-wide leading-tight">
          {c.title}
        </h2>

        <div className="mt-4 flex flex-col items-center gap-1">
          <p className="text-white font-black text-xl sm:text-2xl">📅 {c.dateLabel}</p>
          <p className="text-white font-black text-2xl sm:text-3xl">🕛 {c.timeLabel}</p>
          {c.location && <p className="text-canal-gray-muted text-sm mt-1">📍 {c.location}</p>}
        </div>

        <div className="mt-4 space-y-2 text-left">
          {c.body.map((line, i) => (
            <p key={i} className="text-white/80 text-sm leading-relaxed">{line}</p>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={goQuiz}
            className="w-full py-3.5 rounded-2xl bg-canal-yellow text-canal-black font-black text-base sm:text-lg shadow-lg active:scale-[0.98] transition-transform"
          >
            {c.primaryCta.label}
          </button>
          <button
            onClick={dismiss}
            className="w-full py-3 rounded-2xl bg-white/5 border border-white/15 text-white font-bold text-sm hover:bg-white/10 transition-colors"
          >
            {c.secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
