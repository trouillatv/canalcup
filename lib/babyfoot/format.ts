// Projection de format & durée — helper PUR (aucune I/O).
// L'admin voit AVANT de générer : #équipes, #matchs, durée 1 table / 2 tables,
// pour l'élimination directe ET les poules+élimination, + une recommandation.
// L'organisateur choisit (on n'impose rien).

export type BabyfootFormat = "ko" | "pools_ko";

export interface FormatStructure {
  format: BabyfootFormat;
  teams: number;
  pools: number[]; // tailles des poules (vide en élim. directe)
  poolMatches: number;
  qualifiers: number; // nb de qualifiés pour le tableau final
  koMatches: number; // matchs de la phase finale (dont petite finale)
  totalMatches: number;
}

export interface FormatProjection extends FormatStructure {
  durationOneTableMin: number;
  durationTwoTablesMin: number;
  durationOneTableLabel: string;
  durationTwoTablesLabel: string;
}

// Poules équilibrées, plafonnées à 4 poules → au plus 8 qualifiés (tableau
// propre quart/demi/finale, sans tour préliminaire).
export function planPools(n: number): number[] {
  if (n < 6) return [];
  const nPools = Math.min(4, Math.floor(n / 3));
  if (nPools < 2) return [];
  const base = Math.floor(n / nPools);
  const rem = n % nPools;
  return Array.from({ length: nPools }, (_, i) => base + (i < rem ? 1 : 0));
}

function roundRobinCount(size: number): number {
  return (size * (size - 1)) / 2;
}

// Phase finale à élimination directe pour `m` qualifiés : m-1 matchs + petite
// finale (si au moins des demies, m ≥ 4).
function koMatchesFor(m: number): number {
  if (m < 2) return 0;
  return m - 1 + (m >= 4 ? 1 : 0);
}

export function structureFor(n: number, format: BabyfootFormat): FormatStructure {
  if (format === "pools_ko") {
    const pools = planPools(n);
    if (pools.length >= 2) {
      const poolMatches = pools.reduce((s, sz) => s + roundRobinCount(sz), 0);
      const qualifiers = pools.length * 2;
      const koMatches = koMatchesFor(qualifiers);
      return { format, teams: n, pools, poolMatches, qualifiers, koMatches, totalMatches: poolMatches + koMatches };
    }
    // trop peu d'équipes pour des poules → repli élim. directe
  }
  const koMatches = koMatchesFor(n);
  return { format: "ko", teams: n, pools: [], poolMatches: 0, qualifiers: n, koMatches, totalMatches: koMatches };
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export function project(n: number, format: BabyfootFormat, avgMatchMinutes: number): FormatProjection {
  const s = structureFor(n, format);
  const d1 = Math.ceil(s.totalMatches / 1) * avgMatchMinutes;
  const d2 = Math.ceil(s.totalMatches / 2) * avgMatchMinutes;
  return {
    ...s,
    durationOneTableMin: d1,
    durationTwoTablesMin: d2,
    durationOneTableLabel: fmtDuration(d1),
    durationTwoTablesLabel: fmtDuration(d2),
  };
}

export interface BothProjections {
  ko: FormatProjection;
  poolsKo: FormatProjection;
  recommended: BabyfootFormat;
  reason: string;
}

export function projectBoth(n: number, avgMatchMinutes: number): BothProjections {
  const ko = project(n, "ko", avgMatchMinutes);
  const poolsKo = project(n, "pools_ko", avgMatchMinutes);
  // Reco : à partir de 8 équipes, poules+élim. = plus de matchs garantis pour
  // tout le monde (personne éliminé en 1 match) → plus juste et plus fun.
  const recommended: BabyfootFormat = n >= 8 && poolsKo.pools.length >= 2 ? "pools_ko" : "ko";
  const reason =
    recommended === "pools_ko"
      ? "Chaque binôme joue plusieurs matchs (personne éliminé d'entrée) — plus juste et plus fun."
      : "Peu d'équipes : l'élimination directe va à l'essentiel.";
  return { ko, poolsKo, recommended, reason };
}
