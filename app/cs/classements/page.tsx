import { Trophy } from "lucide-react";
import { PageShell, Section, EmptyState } from "@/components/canal-sports/ui";

export const dynamic = "force-dynamic";

export default function ClassementsPage() {
  return (
    <PageShell>
      <Section title="Classements">
        <EmptyState
          icon={Trophy}
          title="Aucun classement pour l'instant"
          description="Le moteur de classement générique arrive avec les premières compétitions branchées."
        />
      </Section>
    </PageShell>
  );
}
