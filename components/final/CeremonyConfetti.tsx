"use client";

// Confettis de clôture — UNE SEULE FOIS à l'ouverture de la page, puis plus rien.
//
// Deux contraintes :
//  • Pas de `Math.random` / `Date.now` au rendu → positions déterministes, sinon
//    mismatch d'hydratation SSR (même piège que la cérémonie du quiz-show).
//  • Pas d'animation permanente : une page de palmarès qu'on projette pendant
//    20 minutes ne doit pas clignoter sans fin. On démonte après ~9 s.

import { useEffect, useMemo, useState } from "react";

const PIECES = 70;
const DURATION_MS = 9_000;

export function CeremonyConfetti() {
  const [visible, setVisible] = useState(true);

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 12) * 0.16,
        dur: 2.6 + (i % 5) * 0.45,
        color: ["#FFD700", "#FFFFFF", "#E6C200", "#22C55E", "#8A8075"][i % 5],
        size: 6 + (i % 4) * 3,
      })),
    []
  );

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      style={{ animation: "fadeOut 1s ease-in 8s forwards" }}
    >
      {pieces.map((c, i) => (
        <span
          key={i}
          className="absolute top-[-5%] rounded-sm"
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.size * 1.6,
            background: c.color,
            animation: `confettiFall ${c.dur}s linear ${c.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
