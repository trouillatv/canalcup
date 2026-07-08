// Santé du planning — calculée AVANT le tirage (et à chaque inscription).
// Dry-run : on génère plusieurs championnats candidats (ordres différents) et on
// tente de les ordonnancer avec les dispos actuelles, SANS rien persister. On
// rapporte la faisabilité + les binômes problématiques + le remplissage des
// créneaux. But : voir un souci plusieurs jours avant le 10 juillet.

import { generateChampionship } from "@/lib/babyfoot/generate";
import { schedule, type SchedulerSlot } from "@/lib/babyfoot/scheduler";

export interface SlotFill {
  key: string; label: string; count: number; cap: number;
  status: "green" | "orange" | "red" | "closed";
}
export interface PlanningHealth {
  teams: number;
  even: boolean;
  minSlots: number;
  lowSlotBinomes: string[]; // binômes sous le minimum (ou pile au minimum → fragiles)
  allHaveMinSlots: boolean;
  feasible: boolean | null; // null = pas assez d'infos (impair / <4 / dispos manquantes)
  trialsOk: number;
  trials: number;
  problemBinomes: string[]; // binômes dont des matchs n'ont pas pu être placés
  slotFill: SlotFill[];
  ready: boolean; // tout vert : on peut lancer le tirage sereinement
}

interface HealthEntry { team_id: string; label: string; availability: string[]; }

export function planningHealth(
  entries: HealthEntry[],
  opts: {
    slots: SchedulerSlot[]; matchesPerSlot: number; slotStartISO: (k: string) => string | null;
    matchesPerTeam: number; koTarget: number; minSlots: number; slotCap: number; qualifiers: number;
  }
): PlanningHealth {
  const n = entries.length;
  const even = n % 2 === 0;
  const teamIds = entries.map((e) => e.team_id);
  const labelByTeam = new Map(entries.map((e) => [e.team_id, e.label]));
  const avail = new Map(entries.map((e) => [e.team_id, new Set(e.availability)]));

  const lowSlotBinomes = entries.filter((e) => e.availability.length < opts.minSlots).map((e) => e.label);
  const fragile = entries.filter((e) => e.availability.length === opts.minSlots).map((e) => e.label); // pile au min
  const allHaveMinSlots = lowSlotBinomes.length === 0;

  // Remplissage des créneaux (statut couleur).
  const countBySlot = new Map<string, number>();
  for (const e of entries) for (const k of e.availability) countBySlot.set(k, (countBySlot.get(k) ?? 0) + 1);
  const slotFill: SlotFill[] = opts.slots.map((s) => {
    const count = countBySlot.get(s.key) ?? 0;
    const ratio = count / opts.slotCap;
    const status: SlotFill["status"] = count >= opts.slotCap ? "closed" : ratio >= 0.85 ? "red" : ratio >= 0.5 ? "orange" : "green";
    return { key: s.key, label: s.label, count, cap: opts.slotCap, status };
  });

  // Dry-run de faisabilité (plusieurs ordres de tirage).
  let feasible: boolean | null = null;
  let trialsOk = 0;
  const trials = 6;
  const problem = new Set<string>();
  if (even && n >= 4 && allHaveMinSlots) {
    for (let t = 0; t < trials; t++) {
      const order = [...teamIds.slice(t % n), ...teamIds.slice(0, t % n)]; // rotation déterministe
      const gen = generateChampionship(order, opts.matchesPerTeam, opts.koTarget);
      const res = schedule(gen, { slots: opts.slots, matchesPerSlot: opts.matchesPerSlot, slotStartISO: opts.slotStartISO, availabilityByTeam: avail });
      if (res.conflicts.length === 0) trialsOk++;
      else {
        // Repère les binômes impliqués dans des matchs non placés.
        const unplaced = new Set(res.assignments.filter((a) => a.rotation == null).map((a) => a.localId));
        for (const m of gen) if (unplaced.has(m.localId)) { problem.add(labelByTeam.get(m.team_a_id!) ?? "?"); problem.add(labelByTeam.get(m.team_b_id!) ?? "?"); }
      }
    }
    feasible = trialsOk > 0;
  }

  const ready = even && n >= 4 && allHaveMinSlots && feasible === true && trialsOk === trials;
  return {
    teams: n, even, minSlots: opts.minSlots,
    lowSlotBinomes, allHaveMinSlots,
    feasible, trialsOk, trials,
    problemBinomes: feasible === false ? [...problem] : fragile.length && trialsOk < trials ? fragile : [],
    slotFill, ready,
  };
}
