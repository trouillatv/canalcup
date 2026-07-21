"use client";

// Expose le drapeau « Canal Cup terminée » au client, SANS appel réseau
// supplémentaire : le layout serveur le lit une fois et le passe en prop.
//
// ⚠️ Le client ne fait jamais autorité. Il masque/désactive les CTA pour l'UX ;
// c'est `competitionLock()` (serveur) qui refuse réellement l'écriture.

import { createContext, useContext } from "react";
import type { EventStatus } from "@/lib/event/status-core";

const EventStatusContext = createContext<EventStatus>("open");

export function EventStatusProvider({
  status,
  children,
}: {
  status: EventStatus;
  children: React.ReactNode;
}) {
  return (
    <EventStatusContext.Provider value={status}>{children}</EventStatusContext.Provider>
  );
}

export function useEventStatus(): EventStatus {
  return useContext(EventStatusContext);
}

/** Sucre : `const closed = useCompetitionClosed()` pour masquer un bouton de jeu. */
export function useCompetitionClosed(): boolean {
  return useContext(EventStatusContext) === "closed";
}
