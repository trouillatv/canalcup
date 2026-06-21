// ─────────────────────────────────────────────────────────────────────────────
//  COMPOSITION DES POULES — COUPE DU MONDE 2026 (48 équipes, 12 groupes A–L)
//  Tirage au sort officiel du 5 décembre 2025 à Washington D.C.
// ─────────────────────────────────────────────────────────────────────────────
//
//  Noms en français alignés sur lib/utils.ts (TEAM_FLAGS) pour que les
//  drapeaux s'affichent via teamFlag(). Pour modifier une poule, édite
//  simplement le tableau ci-dessous.
// ─────────────────────────────────────────────────────────────────────────────

export interface WCGroup {
  letter: string;
  teams: string[]; // 4 noms (français), ordre = position de tirage 1→4
}

export const WC2026_GROUPS: WCGroup[] = [
  { letter: "A", teams: ["Mexique", "Corée du Sud", "Afrique du Sud", "République Tchèque"] },
  { letter: "B", teams: ["Canada", "Suisse", "Qatar", "Bosnie-Herzégovine"] },
  { letter: "C", teams: ["Brésil", "Maroc", "Écosse", "Haïti"] },
  { letter: "D", teams: ["États-Unis", "Australie", "Paraguay", "Turquie"] },
  { letter: "E", teams: ["Allemagne", "Équateur", "Côte d'Ivoire", "Curaçao"] },
  { letter: "F", teams: ["Pays-Bas", "Japon", "Tunisie", "Suède"] },
  { letter: "G", teams: ["Belgique", "Iran", "Égypte", "Nouvelle-Zélande"] },
  { letter: "H", teams: ["Espagne", "Uruguay", "Arabie Saoudite", "Cap-Vert"] },
  { letter: "I", teams: ["France", "Sénégal", "Norvège", "Irak"] },
  { letter: "J", teams: ["Argentine", "Autriche", "Algérie", "Jordanie"] },
  { letter: "K", teams: ["Portugal", "Colombie", "Ouzbékistan", "RD Congo"] },
  { letter: "L", teams: ["Angleterre", "Croatie", "Ghana", "Panama"] },
];

// Helper : poule (lettre) d'une équipe donnée, ou null si introuvable.
const TEAM_TO_GROUP: Record<string, string> = {};
for (const g of WC2026_GROUPS) {
  for (const t of g.teams) TEAM_TO_GROUP[t] = g.letter;
}

export function groupOfTeam(teamFr: string): string | null {
  return TEAM_TO_GROUP[teamFr] ?? null;
}

// Rapprochement robuste (accents/casse/alias) — pour relier une fiche
// équipe (nom docs) à sa poule officielle. Renvoie null si l'équipe n'est
// pas dans le tirage des 48 (ex. sélections hors phase finale).
function normTeamName(n: string): string {
  return n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const TEAM_TO_GROUP_NORM: Record<string, string> = {};
for (const g of WC2026_GROUPS) {
  for (const t of g.teams) TEAM_TO_GROUP_NORM[normTeamName(t)] = g.letter;
}
// Noms divergents entre la donnée docs (data/wc-teams.json), les fournisseurs
// (API-Football / TheSportsDB renvoient parfois l'anglais) et le tirage.
const TEAM_NAME_ALIASES: Record<string, string> = {
  [normTeamName("Tchéquie")]: normTeamName("République Tchèque"),
  [normTeamName("Czechia")]: normTeamName("République Tchèque"),
  [normTeamName("Czech Republic")]: normTeamName("République Tchèque"),
  [normTeamName("Bosnia & Herzegovina")]: normTeamName("Bosnie-Herzégovine"),
  [normTeamName("Bosnia and Herzegovina")]: normTeamName("Bosnie-Herzégovine"),
  [normTeamName("Türkiye")]: normTeamName("Turquie"),
  [normTeamName("Turkey")]: normTeamName("Turquie"),
  [normTeamName("Cape Verde Islands")]: normTeamName("Cap-Vert"),
  [normTeamName("Cape Verde")]: normTeamName("Cap-Vert"),
  [normTeamName("Cabo Verde")]: normTeamName("Cap-Vert"),
  [normTeamName("Jordan")]: normTeamName("Jordanie"),
  [normTeamName("Iraq")]: normTeamName("Irak"),
  [normTeamName("Congo DR")]: normTeamName("RD Congo"),
  [normTeamName("DR Congo")]: normTeamName("RD Congo"),
  [normTeamName("Congo DR")]: normTeamName("RD Congo"),
  [normTeamName("South Korea")]: normTeamName("Corée du Sud"),
  [normTeamName("South Africa")]: normTeamName("Afrique du Sud"),
  [normTeamName("USA")]: normTeamName("États-Unis"),
  [normTeamName("United States")]: normTeamName("États-Unis"),
  [normTeamName("Ivory Coast")]: normTeamName("Côte d'Ivoire"),
  [normTeamName("Curacao")]: normTeamName("Curaçao"),
  [normTeamName("Saudi Arabia")]: normTeamName("Arabie Saoudite"),
  [normTeamName("Uzbekistan")]: normTeamName("Ouzbékistan"),
  [normTeamName("New Zealand")]: normTeamName("Nouvelle-Zélande"),
};

function resolveNormKey(name: string): string | null {
  const key = normTeamName(name);
  if (TEAM_TO_GROUP_NORM[key]) return key;
  const aliased = TEAM_NAME_ALIASES[key];
  if (aliased && TEAM_TO_GROUP_NORM[aliased]) return aliased;
  return null;
}

export function groupLetterForTeam(name: string): string | null {
  if (!name) return null;
  const key = resolveNormKey(name);
  return key ? TEAM_TO_GROUP_NORM[key] : null;
}

// Nom français officiel canonique d'une équipe (résout les variantes anglaises
// des fournisseurs). Renvoie null si l'équipe n'est pas dans les 48.
const NORM_TO_OFFICIAL_FR: Record<string, string> = {};
for (const g of WC2026_GROUPS) {
  for (const t of g.teams) NORM_TO_OFFICIAL_FR[normTeamName(t)] = t;
}
export function officialTeamFr(name: string): string | null {
  const key = resolveNormKey(name);
  return key ? NORM_TO_OFFICIAL_FR[key] ?? null : null;
}
