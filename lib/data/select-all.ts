// PostgREST plafonne CHAQUE réponse à 1000 lignes (limite serveur, non
// contournable par .range()). Pour les AGRÉGATS (classements, scores) il faut
// lire TOUTES les lignes, sinon les totaux sont tronqués SILENCIEUSEMENT dès
// qu'une table dépasse 1000 lignes (bug réel : un joueur affichait 45 pts au
// lieu de 55 car ses pronos tombaient dans la tranche coupée). On pagine.

const PAGE = 1000;

export async function selectAll<T = Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  table: string,
  columns: string,
  // Filtre optionnel appliqué à chaque page (ex. q => q.in("match_id", ids)).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply?: (q: any) => any
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = client.from(table).select(columns);
    if (apply) q = apply(q);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return out;
}
