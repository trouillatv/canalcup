// PageShell — conteneur de page CANAL Sports.
//
// Utilise les tokens sémantiques déjà déclarés dans tailwind.config.ts /
// globals.css (bg-background, text-foreground…) plutôt que les classes
// canal-* codées en dur pour la Coupe du Monde. L'identité CANAL reste
// forte (même palette chaude, même --primary jaune par défaut) mais un
// sport/une compétition pourra plus tard surcharger --accent sans toucher
// au composant.

import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground",
        "px-4 py-4 space-y-6 max-w-2xl mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
}
