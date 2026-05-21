// <NoTeamCTA> — bannière jaune qui apparaît sur les pages d'activité
// (animations, predictions, babyfoot…) quand l'user N'A PAS d'équipe.
// Remplace les messages d'erreur "Rejoins une équipe d'abord" cachés
// derrière des 400 API : le user comprend immédiatement quoi faire et
// peut cliquer pour aller créer / rejoindre.
//
// Server-side : le composant fait un fetch léger sur la session
// utilisateur via /api/teams/membership/mine et masque le CTA si
// l'user a déjà une équipe.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, AlertTriangle } from "lucide-react";

interface Props {
  /** Contexte affiché dans le message (ex. 'pronostiquer', 's'inscrire à une animation'). */
  action: string;
}

export function NoTeamCTA({ action }: Props) {
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/teams/membership/mine", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setHasTeam((d.teams?.length ?? 0) > 0);
      })
      .catch(() => { if (!cancelled) setHasTeam(true); /* on cache en cas d'erreur */ });
    return () => { cancelled = true; };
  }, []);

  // Tant qu'on ne sait pas, on n'affiche rien (évite le flash sur les
  // users qui ont déjà une équipe).
  if (hasTeam !== false) return null;

  return (
    <div className="canal-card border border-canal-yellow/40 bg-canal-yellow/5 space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={18} className="text-canal-yellow shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-white font-bold text-sm">
            Tu n&apos;as pas encore d&apos;équipe
          </p>
          <p className="text-canal-gray-muted text-xs leading-snug">
            Pour {action}, rejoins ou crée ton binôme Canal Cup (max 2 personnes).
            Les points iront sur ton équipe.
          </p>
        </div>
      </div>
      <Link
        href="/profile"
        className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-canal-yellow text-canal-black font-black text-sm hover:bg-canal-yellow-hover transition-colors"
      >
        <Users size={14} /> Créer ou rejoindre mon équipe
      </Link>
    </div>
  );
}
