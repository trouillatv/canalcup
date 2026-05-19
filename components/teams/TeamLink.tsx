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
import { cn } from "@/lib/utils";

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

  const flagEl = <span className={cn("leading-none shrink-0", flagClassName)}>{flag}</span>;
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
