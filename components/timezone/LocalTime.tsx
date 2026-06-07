"use client";

// Affiche une date/heure dans le fuseau de l'utilisateur courant (via le
// contexte TimezoneProvider). À utiliser partout où un abonné voit un
// horaire de match — y compris dans des Server Components, puisque c'est
// un composant client autonome. Les écrans TV / système restent eux sur
// NC (ils appellent toNC* sans fuseau, cf. lib/utils).

import { toNCDate, toNCDateShort, toNCTime } from "@/lib/utils";
import { useTimezone } from "./TimezoneProvider";

type Variant = "time" | "date" | "dateShort" | "datetime";

export function LocalTime({
  date,
  variant = "time",
  withLabel = false,
  className,
}: {
  date: string | Date;
  variant?: Variant;
  /** Ajoute le libellé de zone (« 18:00 NC ») */
  withLabel?: boolean;
  className?: string;
}) {
  const { tz, label } = useTimezone();

  let text: string;
  switch (variant) {
    case "date":
      text = toNCDate(date, tz);
      break;
    case "dateShort":
      text = toNCDateShort(date, tz);
      break;
    case "datetime":
      text = `${toNCDate(date, tz)} — ${toNCTime(date, tz)}`;
      break;
    default:
      text = toNCTime(date, tz);
  }

  return (
    <span className={className}>
      {text}
      {withLabel ? ` ${label}` : ""}
    </span>
  );
}
