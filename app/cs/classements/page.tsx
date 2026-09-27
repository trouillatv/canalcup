"use client";

// Classements — Lot 3D, classement INDIVIDUEL uniquement (voir ADR 0005 et
// app/api/cs/leaderboard/route.ts). Pas d'agrégation boutique/service dans
// ce lot, décision explicite de l'utilisateur.

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { PageShell, Section, Card, Badge, EmptyState } from "@/components/canal-sports/ui";

interface LeaderboardRow {
  user_id: string;
  name: string;
  points: number;
}

export default function ClassementsPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/cs/leaderboard");
      const body = await res.json().catch(() => ({ leaderboard: [] }));
      setRows(body.leaderboard ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <PageShell>
        <Section title="Classements">
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </Section>
      </PageShell>
    );
  }

  if (rows.length === 0) {
    return (
      <PageShell>
        <Section title="Classements">
          <EmptyState
            icon={Trophy}
            title="Aucun classement pour l'instant"
            description="Les points apparaîtront ici dès que des pronostics auront été réglés."
          />
        </Section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Section title="Classements">
        <div className="space-y-2">
          {rows.map((row, index) => (
            <Card key={row.user_id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={index === 0 ? "success" : "muted"}>{index + 1}</Badge>
                  <span className="font-bold text-sm">{row.name}</span>
                </div>
                <span className="text-sm text-muted-foreground">{row.points} pts</span>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
