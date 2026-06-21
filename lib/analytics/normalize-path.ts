// Normalise un pathname brut en TEMPLATE de route (regroupe les segments
// dynamiques) pour l'agrégation « quelles pages sont utilisées ».
//   /matches/3da1… → /matches/[id]   ·   /wc-team/france → /wc-team/[slug]

const RULES: [RegExp, string][] = [
  [/^\/joueur\/[^/]+$/, "/joueur/[id]"],
  [/^\/teams\/[^/]+$/, "/teams/[id]"],
  [/^\/services\/[^/]+$/, "/services/[id]"],
  [/^\/matches\/[^/]+$/, "/matches/[id]"],
  [/^\/wc-team\/[^/]+$/, "/wc-team/[slug]"],
  [/^\/football\/players\/[^/]+$/, "/football/players/[id]"],
  [/^\/football\/teams\/[^/]+$/, "/football/teams/[id]"],
  [/^\/badge\/[^/]+$/, "/badge/[key]"],
  [/^\/animations\/[^/]+$/, "/animations/[slug]"],
  [/^\/admin\/user-audit\/[^/]+$/, "/admin/user-audit/[id]"],
];

export function normalizePath(raw: string): string {
  let p = (raw || "/").split("?")[0].split("#")[0];
  p = p.replace(/\/+$/, "") || "/";
  for (const [re, tpl] of RULES) if (re.test(p)) return tpl;
  return p;
}

// Routes utilisateur connues — pour détecter celles à 0 vue (« inutilisées »).
// Hors /admin/* (outils) et /tv/* (écrans). Templates inclus.
export const KNOWN_ROUTES: string[] = [
  "/", "/predictions", "/matches", "/matches/[id]", "/leaderboard",
  "/teams", "/teams/[id]", "/binomes", "/services", "/services/[id]",
  "/wc-teams", "/wc-team/[slug]", "/bracket", "/babyfoot",
  "/quiz-live", "/quiz-show", "/jokers", "/animations", "/animations/[slug]",
  "/revivez", "/fil", "/vestiaire", "/supporters", "/matinale",
  "/meilleur-11", "/live", "/inbox", "/profile", "/schedule",
  "/joueur/[id]", "/football/players/[id]", "/badge/[key]",
];
