// Résolution nom de joueur → api_football_id, tolérante aux abréviations.
// Les events de but donnent souvent "M. Oyarzabal" alors que les notes/compos
// ont "Mikel Oyarzabal". On indexe donc aussi par (initiale + nom de famille)
// et par nom de famille, en marquant les collisions comme ambiguës (non résolues
// → on préfère ne PAS lier plutôt que lier le mauvais joueur).

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function buildPlayerResolver(pairs: { name: string; id?: string | null }[]): (name: string) => string | undefined {
  const exact = new Map<string, string>();
  const initialLast = new Map<string, string | null>(); // null = ambigu
  const last = new Map<string, string | null>();
  const put = (m: Map<string, string | null>, k: string, id: string) => {
    if (!k) return;
    if (m.has(k)) { if (m.get(k) !== id) m.set(k, null); } else m.set(k, id);
  };

  for (const { name, id } of pairs) {
    if (!name || !id) continue;
    const n = norm(name);
    if (!n) continue;
    exact.set(n, id);
    const t = n.split(" ");
    if (t.length >= 2) {
      const lastTok = t[t.length - 1];
      put(initialLast, `${t[0][0]} ${lastTok}`, id);
      put(last, lastTok, id);
    }
  }

  return (name: string): string | undefined => {
    const n = norm(name);
    if (!n) return undefined;
    const e = exact.get(n);
    if (e) return e;
    const t = n.split(" ");
    if (t.length >= 2) {
      const lastTok = t[t.length - 1];
      const il = initialLast.get(`${t[0][0]} ${lastTok}`);
      if (il) return il;
      const l = last.get(lastTok);
      if (l) return l;
    } else {
      const l = last.get(t[0]);
      if (l) return l;
    }
    return undefined;
  };
}
