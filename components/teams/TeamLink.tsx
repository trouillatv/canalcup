"use client";

// Nom d'équipe cliquable → fiche /wc-team/[slug] si des données existent,
// sinon texte simple (jamais de lien mort). Composant partagé : bracket,
// liste des matchs, détail match. stopPropagation pour cohabiter avec une
// carte parente cliquable.

import Link from "next/link";
import { wcTeamHref } from "@/lib/football/wc-teams-index";
import { cn } from "@/lib/utils";

export function TeamLink({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const href = wcTeamHref(name);
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
