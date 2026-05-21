// Skeleton screens — placeholders animés pendant le chargement.
// Remplace les "Chargement…" texte basique par des rectangles grisés
// pulsés aux dimensions des cartes finales. UX standard mobile-first.

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...rest }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Chargement"
      className={cn(
        "animate-pulse rounded-lg bg-canal-gray-mid/60",
        className
      )}
      {...rest}
    />
  );
}

/** Préset : ligne de texte */
export function SkeletonText({ width = "100%" }: { width?: string }) {
  return <Skeleton className="h-3" style={{ width }} />;
}

/** Préset : carte d'équipe (header + ligne code + ligne hint) */
export function SkeletonTeamCard() {
  return (
    <div className="bg-canal-gray-mid rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-12" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
