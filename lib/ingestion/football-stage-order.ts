// stage_order (Addendum P2, voir docs/adr/0001-multi-sport-data-model.md
// section "Angle mort 1") : "ordre d'affichage au sein de la saison, calculé
// à l'ingestion (position dans la liste des stages rencontrés)" — jamais une
// constante métier partagée entre compétitions (pas de map LEAGUE_STAGE=1
// codée en dur : un autre provider/compétition pourrait nommer ses stages
// différemment).
//
// Algorithme : les stages sont ordonnés par la date du plus ancien événement
// qui les porte (ordre chronologique d'apparition dans le calendrier), pas
// par ordre alphabétique ni par un référentiel externe.

export function computeStageOrder(
  events: { stage?: string; starts_at: string }[]
): Map<string, number> {
  const earliestByStage = new Map<string, number>();
  for (const e of events) {
    if (!e.stage) continue;
    const ts = new Date(e.starts_at).getTime();
    const current = earliestByStage.get(e.stage);
    if (current === undefined || ts < current) earliestByStage.set(e.stage, ts);
  }
  const orderedStages = [...earliestByStage.entries()].sort((a, b) => a[1] - b[1]).map(([stage]) => stage);
  return new Map(orderedStages.map((stage, i) => [stage, i + 1]));
}
