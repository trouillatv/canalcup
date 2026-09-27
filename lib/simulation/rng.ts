// PRNG seedé (mulberry32) pour le simulateur Lot 3C — jamais Math.random().
// Reproductibilité stricte : même seed + même séquence d'appels => mêmes
// résultats, condition nécessaire pour comparer plusieurs barèmes sur
// exactement les mêmes saisons/profils simulés (voir
// docs/lot3c-scoring-simulation.md, section méthodologie).

export type Rng = () => number;

export function createRng(seed: number): Rng {
  let t = seed >>> 0;
  return function next(): number {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Dérive un sous-seed déterministe à partir d'un seed de base et d'un
// identifiant (nom de flux logique + index) — évite de faire dépendre
// l'ordre d'appel d'un seul flux partagé entre profils/replications, qui
// rendrait les résultats sensibles à l'ordre d'exécution du code.
export function deriveSeed(baseSeed: number, ...parts: (string | number)[]): number {
  let h = baseSeed >>> 0;
  const key = parts.join("|");
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 2654435761);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

// Box-Muller, à partir du flux uniforme du Rng fourni.
export function sampleNormal(rng: Rng, mean = 0, stdDev = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * stdDev;
}

// Knuth : nombre de buts tirés but-par-but, seuil sur produit cumulé.
// Suffisant pour les lambda utilisés ici (< 4).
export function samplePoisson(rng: Rng, lambda: number): number {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > l);
  return k - 1;
}

export function sampleBernoulli(rng: Rng, probabilityTrue: number): boolean {
  return rng() < probabilityTrue;
}

// Choix uniforme dans un tableau non vide.
export function sampleUniformInt(rng: Rng, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}
