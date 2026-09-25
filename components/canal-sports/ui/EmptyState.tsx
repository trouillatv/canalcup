// EmptyState — état vide par défaut des sections du nouveau produit.
//
// Règle du squelette CANAL Sports : tant qu'une section n'a pas de vraie
// donnée branchée (programme, pronostics, brief, classement…), elle
// affiche CET état vide plutôt qu'une donnée inventée. Voir DevMockBadge
// pour le seul cas où une donnée factice est tolérée (dev uniquement).

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-card/40 px-4 py-6 text-center",
        className
      )}
    >
      {Icon && <Icon className="mx-auto mb-2 text-muted-foreground" size={22} strokeWidth={1.6} />}
      <p className="text-sm font-bold text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 leading-snug">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
