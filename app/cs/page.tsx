// Accueil squelette CANAL Sports — P1 : aucune donnée métier inventée.
// Chaque section affiche un état vide tant que le vrai pipeline (Sport/
// Competition/Season/Event, cf. docs/adr/0001) n'est pas branché — ce
// branchement est un chantier P2/P3, pas fait ici.

import { Sparkles, CalendarDays, Target, Newspaper, Trophy } from "lucide-react";
import { PageShell, Section, EmptyState } from "@/components/canal-sports/ui";
import { productConfig } from "@/lib/product/config";
import { isFeatureEnabled } from "@/lib/features/flags";

export const dynamic = "force-dynamic";

export default function CanalSportsHomePage() {
  return (
    <PageShell>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
          {productConfig.tagline}
        </p>
        <h1 className="canal-headline text-3xl text-foreground">{productConfig.name}</h1>
      </div>

      <Section title="À la une">
        <EmptyState
          icon={Sparkles}
          title="Rien à la une pour l'instant"
          description="Cette section affichera les temps forts de la compétition active dès qu'une Season/Event sera branchée."
        />
      </Section>

      {isFeatureEnabled("program") && (
        <Section title="Programme" action={{ label: "Voir tout", href: "/cs/programme" }}>
          <EmptyState
            icon={CalendarDays}
            title="Aucun programme branché"
            description="Le calendrier des événements (Sport → Competition → Season → Event) arrive en P2."
          />
        </Section>
      )}

      {isFeatureEnabled("predictions") && (
        <Section title="Mes pronostics" action={{ label: "Voir tout", href: "/cs/pronostics" }}>
          <EmptyState
            icon={Target}
            title="Aucun pronostic pour l'instant"
            description="Les marchés de pronostic génériques (exact_score, winner…) arrivent en P3."
          />
        </Section>
      )}

      {isFeatureEnabled("briefs") && (
        <Section title="Brief">
          <EmptyState
            icon={Newspaper}
            title="Aucun brief disponible"
            description="Le générateur de brief (EventContext → texte) ne doit jamais inventer un fait sportif — voir docs/adr/0002."
          />
        </Section>
      )}

      {isFeatureEnabled("rankings") && (
        <Section title="Classements" action={{ label: "Voir tout", href: "/cs/classements" }}>
          <EmptyState
            icon={Trophy}
            title="Aucun classement pour l'instant"
            description="Le moteur de classement générique arrive avec les premières compétitions branchées."
          />
        </Section>
      )}
    </PageShell>
  );
}
