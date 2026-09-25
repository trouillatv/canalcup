import { CalendarDays } from "lucide-react";
import { PageShell, Section, EmptyState } from "@/components/canal-sports/ui";

export const dynamic = "force-dynamic";

export default function ProgrammePage() {
  return (
    <PageShell>
      <Section title="Programme">
        <EmptyState
          icon={CalendarDays}
          title="Aucun événement branché"
          description="Cette page listera les événements (matchs, courses…) de la compétition active une fois le modèle Event en place (P2)."
        />
      </Section>
    </PageShell>
  );
}
