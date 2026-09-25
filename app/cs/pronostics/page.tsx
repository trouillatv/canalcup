import { Target } from "lucide-react";
import { PageShell, Section, EmptyState } from "@/components/canal-sports/ui";

export const dynamic = "force-dynamic";

export default function PronosticsPage() {
  return (
    <PageShell>
      <Section title="Mes pronostics">
        <EmptyState
          icon={Target}
          title="Aucun pronostic pour l'instant"
          description="Les marchés de pronostic génériques (exact_score, winner…) arrivent en P3."
        />
      </Section>
    </PageShell>
  );
}
