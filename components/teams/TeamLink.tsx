"use client";

// Équipe cliquable → fiche /wc-team/[slug] si des données existent, sinon
// texte simple (jamais de lien mort). Composant partagé : accueil, bracket,
// liste/détail des matchs, prédictions. stopPropagation pour cohabiter avec
// une carte parente cliquable.
//
// Le DRAPEAU fait partie de la zone cliquable (pas seulement le nom) : passer
// `flag` (emoji) → drapeau + nom dans le MÊME <Link>. Sans `flag`, la sortie
// est identique à l'historique (rétrocompat des appels non convertis).

import Link from "next/link";
import { wcTeamHref } from "@/lib/football/wc-teams-index";
import { toFrench } from "@/lib/football/team-names";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/shared/Flag";

// Convertit la taille de police emoji (flagClassName) en hauteur d'image
// drapeau équivalente, en conservant les éventuels breakpoints responsives.
const TEXT_TO_IMG_H: Record<string, string> = {
  "text-xs": "h-3",
  "text-sm": "h-4",
  "text-base": "h-4",
  "text-lg": "h-5",
  "text-xl": "h-5",
  "text-2xl": "h-6",
  "text-3xl": "h-7",
  "text-4xl": "h-9",
  "text-5xl": "h-11",
  "text-6xl": "h-14",
  "text-7xl": "h-16",
  "text-8xl": "h-20",
};

function flagImgHeight(flagClassName?: string): string {
  if (!flagClassName) return "h-6 w-auto";
  const out: string[] = [];
  for (const token of flagClassName.split(/\s+/)) {
    const m = token.match(/^(.*?:)?(text-(?:xs|sm|base|lg|\d?xl))$/);
    if (m && TEXT_TO_IMG_H[m[2]]) out.push(`${m[1] ?? ""}${TEXT_TO_IMG_H[m[2]]}`);
  }
  return out.length ? `${out.join(" ")} w-auto` : "h-6 w-auto";
}

export function TeamLink({
  name,
  className,
  flag,
  flagClassName,
  stacked,
  flagSide = "left",
  wrapperClassName,
}: {
  name: string;
  /** classes du libellé (nom) */
  className?: string;
  /** emoji drapeau ; si fourni, rendu DANS le lien */
  flag?: string;
  /** taille/classes du drapeau (ex. "text-3xl") */
  flagClassName?: string;
  /** drapeau au-dessus du nom (carte/héros/détail), centré */
  stacked?: boolean;
  /** ordre en ligne quand non empilé */
  flagSide?: "left" | "right";
  /** classes du conteneur (lien ou span) */
  wrapperClassName?: string;
}) {
  // Normalise un éventuel libellé fournisseur non traduit ("Czechia" →
  // "République Tchèque") pour l'affichage, le drapeau (fallback sur le nom)
  // et le lien vers la fiche. Idempotent pour les noms déjà en français.
  name = toFrench(name);
  const href = wcTeamHref(name);

  // Sans drapeau : comportement historique strict (zéro régression).
  if (!flag) {
    if (!href) return <span className={cn("truncate", className)}>{name}</span>;
    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className={cn("truncate hover:text-canal-yellow transition-colors", className)}
      >
        {name}
      </Link>
    );
  }

  const flagEl = (
    <Flag
      flag={flag}
      name={name}
      className={cn("shrink-0 rounded-sm", flagImgHeight(flagClassName))}
      emojiClassName={cn("leading-none shrink-0", flagClassName)}
    />
  );
  const nameEl = <span className={cn("truncate", className)}>{name}</span>;

  const inner = stacked ? (
    <>
      {flagEl}
      {nameEl}
    </>
  ) : flagSide === "right" ? (
    <>
      {nameEl}
      {flagEl}
    </>
  ) : (
    <>
      {flagEl}
      {nameEl}
    </>
  );

  const layout = stacked
    ? "flex flex-col items-center gap-1 min-w-0"
    : "flex items-center gap-1.5 min-w-0";

  if (!href) {
    return <span className={cn(layout, wrapperClassName)}>{inner}</span>;
  }
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={cn(layout, "hover:text-canal-yellow transition-colors", wrapperClassName)}
    >
      {inner}
    </Link>
  );
}
