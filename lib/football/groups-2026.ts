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
// Noms divergents entre la donnée docs (data/wc-teams.json) et le tirage.
const TEAM_NAME_ALIASES: Record<string, string> = {
  [normTeamName("Tchéquie")]: normTeamName("République Tchèque"),
};

export function groupLetterForTeam(name: string): string | null {
  if (!name) return null;
  const key = normTeamName(name);
  return (
    TEAM_TO_GROUP_NORM[key] ??
    TEAM_TO_GROUP_NORM[TEAM_NAME_ALIASES[key] ?? ""] ??
    null
  );
}
