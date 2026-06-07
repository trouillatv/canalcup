"use client";

// Contexte fuseau horaire de l'utilisateur courant. Alimenté UNE fois par
// le layout racine (qui lit users.timezone côté serveur) et consommé par
// tous les composants client qui affichent une heure de match. La valeur
// venant du serveur, le rendu SSR et l'hydratation client concordent →
// aucun mismatch d'hydratation.

import { createContext, useContext } from "react";
import { DEFAULT_TZ, tzLabel } from "@/lib/utils";

const TimezoneContext = createContext<string>(DEFAULT_TZ);

export function TimezoneProvider({
  tz,
  children,
}: {
  tz: string;
  children: React.ReactNode;
}) {
  return <TimezoneContext.Provider value={tz}>{children}</TimezoneContext.Provider>;
}

export function useTimezone(): { tz: string; label: string } {
  const tz = useContext(TimezoneContext);
  return { tz, label: tzLabel(tz) };
}
