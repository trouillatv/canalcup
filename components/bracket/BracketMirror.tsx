"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  TABLEAU COMPLET « MIROIR FIFA » — zoomable.
//  Partie A coule vers la DROITE, Partie B coule vers la GAUCHE, la FINALE est
//  au CENTRE : le vainqueur de A y rencontre le vainqueur de B. Tout est projeté
//  depuis la matrice officielle (resolveKnockout) ; conteneur zoom + pan
//  (molette, pinch, glisser, boutons) pour explorer l'arbre entier.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Minus, Maximize2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/shared/Flag";
import { resolveKnockout, type ResolvedMatch } from "@/lib/football/bracket-2026";

interface StandingRow {
  team_name_fr: string;
  team_flag: string;
  rank: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}
interface BracketData { standings: Record<string, StandingRow[]> }

const HEADER_H = "h-10";
const COL_HEIGHT = 8 * 92 + 40; // 8 = nb de 16es par moitié ; pitch 92 > carte

// ─── Zoom + pan (molette, pinch, glisser, boutons) ───────────────────────────

function clampScale(s: number): number {
  return Math.min(3, Math.max(0.3, s));
}

function ZoomPan({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDist = useRef<number | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setT((prev) => {
      const scale = clampScale(prev.scale * factor);
      const k = scale / prev.scale;
      return { scale, x: cx - k * (cx - prev.x), y: cy - k * (cy - prev.y) };
    });
  }, []);

  // Molette = zoom autour du curseur (listener natif non-passif pour preventDefault).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const rectXY = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = rectXY(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      panStart.current = { x: p.x, y: p.y, tx: t.x, ty: t.y };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = rectXY(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2 && pinchDist.current != null) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinchDist.current > 0) zoomAt(dist / pinchDist.current, mid.x, mid.y);
      pinchDist.current = dist;
    } else if (pointers.current.size === 1 && panStart.current) {
      const s = panStart.current;
      setT((prev) => ({ ...prev, x: s.tx + (p.x - s.x), y: s.ty + (p.y - s.y) }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  };

  const center = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { cx: (r?.width ?? 0) / 2, cy: (r?.height ?? 0) / 2 };
  };
  const zoomBtn = (factor: number) => { const { cx, cy } = center(); zoomAt(factor, cx, cy); };
  const reset = () => setT({ scale: 1, x: 0, y: 0 });
  const fit = () => {
    const wrap = wrapRef.current, content = contentRef.current;
    if (!wrap || !content) return;
    const sx = wrap.clientWidth / content.scrollWidth;
    const sy = wrap.clientHeight / content.scrollHeight;
    const scale = clampScale(Math.min(sx, sy) * 0.98);
    const x = (wrap.clientWidth - content.scrollWidth * scale) / 2;
    const y = (wrap.clientHeight - content.scrollHeight * scale) / 2;
    setT({ scale, x, y });
  };

  // Ajuste automatiquement au premier rendu pour montrer tout l'arbre.
  useEffect(() => { fit(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="relative rounded-xl border border-canal-gray-light/30 bg-canal-black/40 overflow-hidden h-[68vh] min-h-[400px]">
      <div
        ref={wrapRef}
        className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={contentRef}
          className="origin-top-left inline-block"
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` }}
        >
          {children}
        </div>
      </div>

      {/* Contrôles */}
      <div className="absolute top-2 right-2 flex flex-col gap-1.5" style={{ touchAction: "none" }}>
        {[
          { icon: <Plus size={16} />, fn: () => zoomBtn(1.2), label: "Zoom +" },
          { icon: <Minus size={16} />, fn: () => zoomBtn(1 / 1.2), label: "Zoom −" },
          { icon: <Maximize2 size={15} />, fn: fit, label: "Ajuster" },
          { icon: <RotateCcw size={15} />, fn: reset, label: "Réinitialiser" },
        ].map((b, i) => (
          <button
            key={i}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={b.fn}
            aria-label={b.label}
            title={b.label}
            className="w-9 h-9 rounded-lg bg-canal-gray-mid/90 border border-canal-gray-light/40 text-white flex items-center justify-center hover:bg-canal-yellow hover:text-canal-black transition-colors"
          >
            {b.icon}
          </button>
        ))}
      </div>

      <div className="absolute bottom-2 left-2 text-[10px] text-canal-gray-muted/80 bg-canal-black/50 rounded px-2 py-1 pointer-events-none">
        Molette / pincer pour zoomer · glisser pour déplacer
      </div>
    </div>
  );
}

// ─── Cartes & colonnes ───────────────────────────────────────────────────────

function SlotLine({ slot, big }: { slot: ResolvedMatch["a"]; big?: boolean }) {
  if (slot.teamName) {
    return (
      <div className="px-2 py-1 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0">
          {slot.confirmed && <span className="shrink-0 text-green-400 font-black text-xs leading-none" title="Qualifié — position actée">✓</span>}
          <Flag flag={slot.teamFlag} name={slot.teamName} className="h-3.5 w-auto rounded-sm" emojiClassName={big ? "text-lg" : "text-base"} />
          <span className={cn("font-bold truncate", big ? "text-sm" : "text-xs", slot.confirmed ? "text-green-300" : "text-white")}>{slot.teamName}</span>
        </span>
        <span className="block pl-[22px] text-[8px] text-canal-gray-muted truncate leading-tight">
          {slot.sub}{slot.confirmed ? <span className="text-green-400/80"> · validé</span> : <span className="text-canal-yellow/70"> · prov.</span>}
        </span>
      </div>
    );
  }
  return (
    <div className="px-2 py-1.5">
      <span className={cn("font-semibold text-canal-gray-muted", big ? "text-xs" : "text-[11px]")}>{slot.label}</span>
    </div>
  );
}

function MirrorCard({ m, big }: { m: ResolvedMatch; big?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden bg-canal-gray-mid/40",
        big ? "w-60 border-canal-yellow/50 shadow-[0_0_30px_rgba(255,215,0,0.2)]" : "w-44 border-canal-gray-light/40"
      )}
    >
      <div className="px-2 pt-1 text-[8px] uppercase tracking-wider text-canal-gray-muted font-bold">{m.code}</div>
      <SlotLine slot={m.a} big={big} />
      <div className="h-px bg-canal-gray-light/30 mx-2" />
      <SlotLine slot={m.b} big={big} />
    </div>
  );
}

function MirrorColumn({ title, matches, side }: { title: string; matches: ResolvedMatch[]; side: "A" | "B" }) {
  return (
    <div className="flex flex-col shrink-0">
      <div className={cn(HEADER_H, "flex items-center justify-center px-2")}>
        <span className={cn("font-black uppercase tracking-widest text-[10px] whitespace-nowrap", side === "A" ? "text-canal-yellow/70" : "text-sky-300/70")}>
          {title}
        </span>
      </div>
      <div className="flex-1 flex flex-col px-1">
        {matches.map((m) => (
          <div key={m.code} className="flex-1 flex items-center justify-center">
            <MirrorCard m={m} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MirrorConnector({ count, dir }: { count: number; dir: "left" | "right" }) {
  return (
    <div className="flex flex-col w-5 sm:w-7 shrink-0">
      <div className={HEADER_H} />
      <div className="flex-1 flex flex-col">
        {Array.from({ length: count }).map((_, j) => (
          <div key={j} className="flex-1 flex items-center">
            <div
              className={cn(
                "h-1/2 w-full border-canal-yellow/25",
                dir === "right" ? "border-r-2 border-t-2 border-b-2 rounded-r-md" : "border-l-2 border-t-2 border-b-2 rounded-l-md"
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function BracketMirror({ data }: { data: BracketData }) {
  const [mode, setMode] = useState<"projection" | "reel">("projection");
  const rounds = resolveKnockout(data.standings, mode);
  const byKey: Record<string, ResolvedMatch[]> = {};
  for (const r of rounds) byKey[r.round] = r.matches;

  const s = byKey["Seizièmes"] ?? [];
  const h = byKey["Huitièmes"] ?? [];
  const q = byKey["Quarts"] ?? [];
  const d = byKey["Demis"] ?? [];
  const finale = (byKey["Finale"] ?? [])[0];

  const fh = (a: ResolvedMatch[]) => a.slice(0, Math.ceil(a.length / 2));
  const sh = (a: ResolvedMatch[]) => a.slice(Math.ceil(a.length / 2));

  // Partie A (haute) : coule vers la droite — 16es → 8es → Quarts → Demi.
  const left: Array<{ title: string; matches: ResolvedMatch[] }> = [
    { title: "16es", matches: fh(s) },
    { title: "8es", matches: fh(h) },
    { title: "Quarts", matches: fh(q) },
    { title: "Demi", matches: fh(d) },
  ];
  // Partie B (basse) : coule vers la gauche — Demi → Quarts → 8es → 16es.
  const right: Array<{ title: string; matches: ResolvedMatch[] }> = [
    { title: "Demi", matches: sh(d) },
    { title: "Quarts", matches: sh(q) },
    { title: "8es", matches: sh(h) },
    { title: "16es", matches: sh(s) },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-2xl">🗺️</span>
        <h3 className="font-black text-lg text-white uppercase tracking-widest">Tableau complet</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-canal-yellow/50 to-transparent min-w-[20px]" />
        <div className="flex items-center rounded-lg bg-canal-gray-mid/60 p-0.5 shrink-0">
          <button onClick={() => setMode("projection")} className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors", mode === "projection" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white")}>🔮 Projection</button>
          <button onClick={() => setMode("reel")} className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors", mode === "reel" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white")}>🔒 Réel</button>
        </div>
      </div>

      <p className="text-[11px] mb-3 text-canal-yellow/90">
        ⚠ <span className="font-bold">Miroir</span> : Partie A (haute) à gauche, Partie B (basse) à droite ; le vainqueur de chaque moitié se retrouve en <span className="font-bold">finale au centre</span>.
      </p>

      <ZoomPan>
        <div className="px-3 py-2">
          {/* Légende des deux moitiés */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-canal-yellow/80">🔼 Partie A · haute</span>
            <span className="text-[11px] font-black uppercase tracking-widest text-sky-300/80">Partie B · basse 🔽</span>
          </div>

          <div className="flex items-stretch" style={{ height: `${COL_HEIGHT}px` }}>
            {/* Partie A (gauche, → centre) */}
            {left.map((col, i) => (
              <div key={`L${i}`} className="flex items-stretch">
                <MirrorColumn title={col.title} matches={col.matches} side="A" />
                <MirrorConnector count={left[i + 1]?.matches.length ?? 1} dir="right" />
              </div>
            ))}

            {/* Finale au centre */}
            <div className="flex flex-col shrink-0">
              <div className={cn(HEADER_H, "flex items-center justify-center")}>
                <span className="font-black uppercase tracking-widest text-canal-yellow text-sm whitespace-nowrap">🏆 Finale</span>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center px-2 gap-2">
                {finale ? <MirrorCard m={finale} big /> : null}
                <span className="text-[9px] text-canal-gray-muted uppercase tracking-widest">A&nbsp;—&nbsp;B</span>
              </div>
            </div>

            {/* Partie B (centre →, droite). Le connecteur fusionne vers la
                colonne de GAUCHE (vers le centre) → count = sa taille (Finale=1
                pour le premier). */}
            {right.map((col, i) => (
              <div key={`R${i}`} className="flex items-stretch">
                <MirrorConnector count={i === 0 ? 1 : right[i - 1].matches.length} dir="left" />
                <MirrorColumn title={col.title} matches={col.matches} side="B" />
              </div>
            ))}
          </div>
        </div>
      </ZoomPan>
    </div>
  );
}
