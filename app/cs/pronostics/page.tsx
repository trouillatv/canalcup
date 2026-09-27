"use client";

// Mes pronostics — Lot 3D, Architecture B (une seule prediction exact_score
// par (user, event), voir ADR 0005). Le verrou visuel (input désactivé une
// fois le coup d'envoi dépassé) est un confort client — l'application
// réelle du verrou reste serveur, via le trigger enforce_prediction_lock()
// derrière POST /api/cs/predictions (403 si le match a déjà commencé).

import { useEffect, useState } from "react";
import { Target, Lock, Check, AlertCircle } from "lucide-react";
import { PageShell, Section, Card, Badge, EmptyState } from "@/components/canal-sports/ui";
import { createClient } from "@/lib/supabase/client";

interface EventParticipant {
  role: "home" | "away";
  participants: { id: string; name: string; short_name: string | null } | null;
}

interface UpcomingEvent {
  id: string;
  starts_at: string;
  status: string;
  matchday: number | null;
  event_participants: EventParticipant[];
}

interface MyPrediction {
  id: string;
  event_id: string;
  payload: { home: number; away: number };
  status: "pending" | "settled" | "void";
  points_awarded: number | null;
}

function teamName(ev: UpcomingEvent, role: "home" | "away"): string {
  const p = ev.event_participants.find((x) => x.role === role)?.participants;
  return p?.short_name || p?.name || "?";
}

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export default function PronosticsPage() {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [predictions, setPredictions] = useState<Record<string, MyPrediction>>({});
  const [drafts, setDrafts] = useState<Record<string, { home: string; away: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: upcoming } = await supabase
        .from("events")
        .select("id, starts_at, status, matchday, event_participants(role, participants(id, name, short_name))")
        .eq("status", "scheduled")
        .order("starts_at", { ascending: true })
        .limit(20);

      const res = await fetch("/api/cs/predictions");
      const body = await res.json().catch(() => ({ predictions: [] }));

      const byEvent: Record<string, MyPrediction> = {};
      for (const p of body.predictions ?? []) {
        byEvent[p.event_id] = p;
      }

      setEvents((upcoming ?? []) as unknown as UpcomingEvent[]);
      setPredictions(byEvent);
      setLoading(false);
    })();
  }, []);

  const draftFor = (eventId: string) => {
    if (drafts[eventId]) return drafts[eventId];
    const existing = predictions[eventId];
    return {
      home: existing ? String(existing.payload.home) : "",
      away: existing ? String(existing.payload.away) : "",
    };
  };

  const updateDraft = (eventId: string, field: "home" | "away", value: string) => {
    setDrafts((d) => ({ ...d, [eventId]: { ...draftFor(eventId), [field]: value } }));
  };

  const submit = async (eventId: string) => {
    const draft = draftFor(eventId);
    const home = Number(draft.home);
    const away = Number(draft.away);
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
      setErrors((e) => ({ ...e, [eventId]: "Score invalide" }));
      return;
    }
    setSaving(eventId);
    setErrors((e) => ({ ...e, [eventId]: "" }));
    try {
      const res = await fetch("/api/cs/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, payload: { home, away } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors((e) => ({ ...e, [eventId]: data?.error ?? `HTTP ${res.status}` }));
        return;
      }
      setPredictions((p) => ({ ...p, [eventId]: data.prediction }));
    } catch (err) {
      setErrors((e) => ({ ...e, [eventId]: err instanceof Error ? err.message : "Erreur réseau" }));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <Section title="Mes pronostics">
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </Section>
      </PageShell>
    );
  }

  if (events.length === 0) {
    return (
      <PageShell>
        <Section title="Mes pronostics">
          <EmptyState
            icon={Target}
            title="Aucun match à pronostiquer"
            description="Les prochains matchs de Champions League apparaîtront ici dès qu'ils seront programmés."
          />
        </Section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Section title="Mes pronostics">
        <div className="space-y-3">
          {events.map((ev) => {
            const locked = ev.status !== "scheduled" || new Date(ev.starts_at).getTime() <= Date.now();
            const existing = predictions[ev.id];
            const draft = draftFor(ev.id);
            return (
              <Card key={ev.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{formatKickoff(ev.starts_at)}</span>
                  {existing?.status === "settled" ? (
                    <Badge variant="success">{existing.points_awarded ?? 0} pts</Badge>
                  ) : locked ? (
                    <Badge variant="muted"><Lock size={10} /> Verrouillé</Badge>
                  ) : existing ? (
                    <Badge variant="default"><Check size={10} /> Enregistré</Badge>
                  ) : null}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="flex-1 text-right font-bold text-sm truncate">{teamName(ev, "home")}</span>
                  <input
                    type="number" min={0} max={20} disabled={locked}
                    value={draft.home}
                    onChange={(e) => updateDraft(ev.id, "home", e.target.value)}
                    className="w-12 text-center bg-muted border border-border rounded-lg py-1.5 text-foreground disabled:opacity-50"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="number" min={0} max={20} disabled={locked}
                    value={draft.away}
                    onChange={(e) => updateDraft(ev.id, "away", e.target.value)}
                    className="w-12 text-center bg-muted border border-border rounded-lg py-1.5 text-foreground disabled:opacity-50"
                  />
                  <span className="flex-1 text-left font-bold text-sm truncate">{teamName(ev, "away")}</span>
                </div>
                {!locked && (
                  <button
                    onClick={() => submit(ev.id)}
                    disabled={saving === ev.id}
                    className="mt-3 w-full py-2 bg-primary text-primary-foreground font-bold text-sm rounded-lg disabled:opacity-40"
                  >
                    {saving === ev.id ? "Enregistrement…" : existing ? "Modifier" : "Valider"}
                  </button>
                )}
                {errors[ev.id] && (
                  <p className="mt-2 text-canal-red text-xs flex items-center gap-1">
                    <AlertCircle size={12} /> {errors[ev.id]}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </Section>
    </PageShell>
  );
}
