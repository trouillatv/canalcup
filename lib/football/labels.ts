// Traductions FR des libellés API-Football (stats + détails d'événements),
// affichés dans le centre du match. Fallback sur la valeur d'origine si inconnue.

const STAT_FR: Record<string, string> = {
  "Shots on Goal": "Tirs cadrés",
  "Shots off Goal": "Tirs non cadrés",
  "Total Shots": "Tirs totaux",
  "Blocked Shots": "Tirs bloqués",
  "Shots insidebox": "Tirs dans la surface",
  "Shots outsidebox": "Tirs hors surface",
  "Fouls": "Fautes",
  "Corner Kicks": "Corners",
  "Offsides": "Hors-jeu",
  "Ball Possession": "Possession",
  "Yellow Cards": "Cartons jaunes",
  "Red Cards": "Cartons rouges",
  "Goalkeeper Saves": "Arrêts du gardien",
  "Total passes": "Passes totales",
  "Passes accurate": "Passes réussies",
  "Passes %": "% passes réussies",
  "expected_goals": "Buts attendus (xG)",
  "goals_prevented": "Buts évités",
};

export function statLabelFr(statType: string | null | undefined): string {
  if (!statType) return "";
  return STAT_FR[statType] ?? statType;
}

const EVENT_DETAIL_FR: Record<string, string> = {
  "Normal Goal": "But",
  "Penalty": "Penalty",
  "Own Goal": "But contre son camp",
  "Missed Penalty": "Penalty manqué",
  "Yellow Card": "Carton jaune",
  "Red Card": "Carton rouge",
  "Second Yellow card": "2e jaune (exclusion)",
  "Foul": "Faute",
  "Goal Disallowed": "But refusé",
  "Goal Disallowed - offside": "But refusé (hors-jeu)",
  "Goal cancelled": "But annulé",
  "Penalty confirmed": "Penalty confirmé",
};

export function eventDetailFr(detail: string | null | undefined): string {
  if (!detail) return "";
  if (EVENT_DETAIL_FR[detail]) return EVENT_DETAIL_FR[detail];
  // Remplacements : "Substitution 1/2/3…" → "Remplacement"
  if (/^substitution/i.test(detail)) return "Remplacement";
  return detail;
}
