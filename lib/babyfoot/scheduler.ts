// Ordonnanceur baby-foot — UNE table, créneaux de 30 min. Place chaque match sur
// un créneau où les DEUX binômes sont disponibles, sans dépasser la capacité du
// créneau (3 matchs/créneau) et sans qu'une équipe joue 2 matchs dans le même
// créneau. Best-effort : évite les créneaux consécutifs, signale les conflits.

import type { GenMatch } from "@/lib/babyfoot/generate";

export interface SchedulerSlot { key: string; day: "thu" | "fri"; start: string; label: string; }

export interface ScheduleOpts {
  slots: SchedulerSlot[]; // les 12 créneaux, dans l'ordre
  matchesPerSlot: number; // capacité planning (1 table → 3)
  slotStartISO: (key: string) => string | null;
  availabilityByTeam?: Map<string, Set<string>>; // team_id → slot_keys dispo (absent = tous)
  forceDay?: "thu" | "fri"; // finales : uniquement ce jour, dispos ignorées
}

export interface ScheduledAssignment {
  localId: string;
  slotKey: string | null;
  rotation: number | null; // ordinal du créneau (1..12) — sert de regroupement
  table_no: number | null;
  startISO: string | null;
  startLabel: string | null;
}

export interface ScheduleResult {
  assignments: ScheduledAssignment[];
  warnings: string[];
  conflicts: string[]; // matchs non plaçables (aucun créneau commun libre)
}

export function schedule(matches: GenMatch[], opts: ScheduleOpts): ScheduleResult {
  const slotOrdinal = new Map(opts.slots.map((s, i) => [s.key, i + 1]));
  const usable = opts.forceDay ? opts.slots.filter((s) => s.day === opts.forceDay) : opts.slots;

  const perSlot = new Map<string, number>();
  const teamsInSlot = new Map<string, Set<string>>();
  const teamOrdinals = new Map<string, number[]>();

  const assignments: ScheduledAssignment[] = [];
  const conflicts: string[] = [];
  const warnings: string[] = [];

  const ordered = [...matches].sort((a, b) => (a.order_idx ?? 0) - (b.order_idx ?? 0));
  for (const m of ordered) {
    const a = m.team_a_id!, b = m.team_b_id!;
    const availA = opts.forceDay ? undefined : opts.availabilityByTeam?.get(a);
    const availB = opts.forceDay ? undefined : opts.availabilityByTeam?.get(b);

    let placed = false;
    for (const s of usable) {
      if (availA && !availA.has(s.key)) continue;
      if (availB && !availB.has(s.key)) continue;
      if ((perSlot.get(s.key) ?? 0) >= opts.matchesPerSlot) continue;
      const teams = teamsInSlot.get(s.key) ?? new Set<string>();
      if (teams.has(a) || teams.has(b)) continue;

      // Placement.
      perSlot.set(s.key, (perSlot.get(s.key) ?? 0) + 1);
      teams.add(a); teams.add(b); teamsInSlot.set(s.key, teams);
      const ord = slotOrdinal.get(s.key)!;
      assignments.push({ localId: m.localId, slotKey: s.key, rotation: ord, table_no: 1, startISO: opts.slotStartISO(s.key), startLabel: s.label });
      for (const t of [a, b]) {
        const prev = teamOrdinals.get(t) ?? [];
        if (prev.includes(ord - 1)) warnings.push(`Un binôme enchaîne 2 créneaux d'affilée.`);
        prev.push(ord); teamOrdinals.set(t, prev);
      }
      placed = true;
      break;
    }
    if (!placed) {
      assignments.push({ localId: m.localId, slotKey: null, rotation: null, table_no: null, startISO: null, startLabel: null });
      conflicts.push(m.round ?? m.localId);
    }
  }
  return { assignments, warnings: [...new Set(warnings)], conflicts };
}
