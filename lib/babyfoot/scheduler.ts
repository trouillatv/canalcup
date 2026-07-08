// Ordonnanceur baby-foot — helper PUR. Place des matchs dans des ROTATIONS
// (1 à `tables` matchs joués en parallèle), calcule les horaires, respecte au
// mieux les disponibilités (jeudi/vendredi). Contraintes DURES : une équipe ne
// joue jamais deux fois dans la même rotation. Contraintes SOUPLES (best-effort) :
// éviter deux rotations consécutives, respecter les dispos. Rien de bloquant.

import type { GenMatch } from "@/lib/babyfoot/generate";

export type Day = "thu" | "fri";

export interface ScheduleOpts {
  tables: number;
  matchMinutes: number;
  rotationMinutes: number;
  dayStart: string; // "11:00"
  dayDate: Record<Day, string>; // { thu: "2026-07-16", fri: "2026-07-17" }
  tz?: string; // offset ISO, ex "+11:00"
  availabilityByTeam?: Map<string, Set<Day>>; // dispos ; absent = les deux jours
  forceDay?: Day; // force tous les matchs sur ce jour (finales = vendredi)
  rotationOffset?: number; // 1ère rotation (pour enchaîner après la phase 1)
}

export interface ScheduledAssignment {
  localId: string;
  day: Day | null; // null = conflit (les 2 équipes n'ont aucun jour commun)
  rotation: number | null;
  table_no: number | null;
  startISO: string | null;
  startLabel: string | null; // "11h08"
}

export interface ScheduleResult {
  assignments: ScheduledAssignment[];
  warnings: string[]; // ex. "Léty joue 2 rotations d'affilée"
  conflicts: string[]; // matchs sans jour commun
}

function feasibleDays(a: string | null, b: string | null, avail?: Map<string, Set<Day>>): Set<Day> {
  const da = (a && avail?.get(a)) || new Set<Day>(["thu", "fri"]);
  const db = (b && avail?.get(b)) || new Set<Day>(["thu", "fri"]);
  const out = new Set<Day>();
  for (const d of da) if (db.has(d)) out.add(d);
  return out;
}

function clockToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minToLabel(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function schedule(matches: GenMatch[], opts: ScheduleOpts): ScheduleResult {
  const tz = opts.tz ?? "+11:00";
  const step = opts.matchMinutes + opts.rotationMinutes;
  const startMin = clockToMin(opts.dayStart);
  const avail = opts.availabilityByTeam;

  const assignments: ScheduledAssignment[] = [];
  const conflicts: string[] = [];

  // 1) Jour de chaque match.
  const byDay: Record<Day, GenMatch[]> = { thu: [], fri: [] };
  for (const m of matches) {
    if (opts.forceDay) { byDay[opts.forceDay].push(m); continue; }
    const feas = feasibleDays(m.team_a_id, m.team_b_id, avail);
    if (feas.has("thu")) byDay.thu.push(m);
    else if (feas.has("fri")) byDay.fri.push(m);
    else { assignments.push({ localId: m.localId, day: null, rotation: null, table_no: null, startISO: null, startLabel: null }); conflicts.push(m.round ?? m.localId); }
  }

  // 2) Packing greedy par jour → rotations (ordre = order_idx = journées).
  const warnings: string[] = [];
  let rotationCounter = opts.rotationOffset ?? 1;

  (["thu", "fri"] as Day[]).forEach((day) => {
    const dayMatches = byDay[day].slice().sort((a, b) => (a.order_idx ?? 0) - (b.order_idx ?? 0));
    if (!dayMatches.length) return;
    const rotations: { teams: Set<string>; matches: GenMatch[] }[] = [];
    for (const m of dayMatches) {
      const a = m.team_a_id!, b = m.team_b_id!;
      let placed = false;
      for (const rot of rotations) {
        if (rot.matches.length < opts.tables && !rot.teams.has(a) && !rot.teams.has(b)) {
          rot.matches.push(m); rot.teams.add(a); rot.teams.add(b); placed = true; break;
        }
      }
      if (!placed) rotations.push({ teams: new Set([a, b]), matches: [m] });
    }

    // Horaires + tables + détection back-to-back.
    const lastRotationOfTeam = new Map<string, number>();
    rotations.forEach((rot, ri) => {
      const globalRot = rotationCounter + ri;
      const startTime = startMin + ri * step;
      const dateStr = opts.dayDate[day];
      const startISO = `${dateStr}T${String(Math.floor(startTime / 60)).padStart(2, "0")}:${String(startTime % 60).padStart(2, "0")}:00${tz}`;
      rot.matches.forEach((m, ti) => {
        assignments.push({
          localId: m.localId, day, rotation: globalRot, table_no: ti + 1,
          startISO, startLabel: minToLabel(startTime),
        });
        for (const t of [m.team_a_id!, m.team_b_id!]) {
          const prev = lastRotationOfTeam.get(t);
          if (prev != null && globalRot - prev === 1) warnings.push(`Une équipe joue 2 rotations d'affilée (rotation ${prev}→${globalRot}).`);
          lastRotationOfTeam.set(t, globalRot);
        }
      });
    });
    rotationCounter += rotations.length;
  });

  return { assignments, warnings: [...new Set(warnings)], conflicts };
}
