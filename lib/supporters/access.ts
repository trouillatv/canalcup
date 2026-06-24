// Accès BETA à la Journée Supporters — réservé le temps du test à quelques
// comptes + aux admins. Pur (client + serveur), aucune dépendance serveur.
// Pour ouvrir au public : vider SUPPORTERS_BETA_EMAILS et retirer le gating
// dans app/supporters/page.tsx + l'entrée de menu (components/layout/TopBar.tsx).

// Ouvert à TOUS (liste vide = public). La beta de test est terminée : la page
// est annoncée à l'ensemble des joueurs. Les publications restent verrouillées
// jusqu'à mardi (cf. PUBLISH_OPEN_AT), mais la page (votes, galerie) est visible.
export const SUPPORTERS_BETA_EMAILS: string[] = [];

/** L'accès est-il ouvert à tout le monde ? (liste beta vide) */
export const SUPPORTERS_PUBLIC = SUPPORTERS_BETA_EMAILS.length === 0;

export function isSupportersBetaEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPPORTERS_BETA_EMAILS.includes(email.toLowerCase());
}

export function canAccessSupporters(
  role: string | null | undefined,
  email: string | null | undefined
): boolean {
  if (SUPPORTERS_PUBLIC) return true;
  if (role === "event_admin" || role === "admin" || role === "super_admin") return true;
  return isSupportersBetaEmail(email);
}

// ─── Organisateurs (Marie & Vincent) ─────────────────────────────────────────
// Voient les votes au fil de l'eau + l'onglet « N'ont pas voté ». Indépendant du
// rôle allowlist : on s'appuie sur l'email pour être sûr qu'ils y aient accès.
export const SUPPORTERS_ORGANIZER_EMAILS: string[] = [
  "marie.lucas@canal-plus.com",
  "vincent.trouillat@canal-plus.com",
  "trouillatv@gmail.com",
];

export function isSupportersOrganizer(
  role: string | null | undefined,
  email: string | null | undefined
): boolean {
  if (role === "event_admin" || role === "admin" || role === "super_admin") return true;
  return !!email && SUPPORTERS_ORGANIZER_EMAILS.includes(email.toLowerCase());
}

// ─── Clôture des votes ────────────────────────────────────────────────────────
// Jeudi 25 juin 2026 à 23:59:59 heure de Nouvelle-Calédonie (UTC+11).
export const VOTES_CLOSE_AT = "2026-06-25T23:59:59+11:00";

export function votesClosed(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(VOTES_CLOSE_AT).getTime();
}

// Début du dernier jour de vote (même journée NC que la clôture, à 00:00).
export const VOTES_LAST_DAY_START = "2026-06-25T00:00:00+11:00";

/** Sommes-nous le dernier jour de vote (journée NC du 25/06, votes encore ouverts) ? */
export function isLastVoteDay(now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= new Date(VOTES_LAST_DAY_START).getTime() && t < new Date(VOTES_CLOSE_AT).getTime();
}

// ─── Ouverture des publications ───────────────────────────────────────────────
// Les binômes ne peuvent publier (photo OU vidéo) qu'à partir du mardi 23/06.
// ⚠️ Fuseau Nouvelle-Calédonie (UTC+11) : on ouvre au DÉBUT du mardi NC, pas à
// 08:00 Paris (= 17:00 NC, ce qui bloquait les binômes toute la matinée NC).
export const PUBLISH_OPEN_AT = "2026-06-23T00:00:00+11:00";

export function publishOpen(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(PUBLISH_OPEN_AT).getTime();
}

// ─── Réactions emoji rapides ──────────────────────────────────────────────────
// Tap sous une photo (pas un commentaire). Alimentent les prix auto (😂 plus
// drôle, ❤️ coup de cœur…). Ordre = ordre d'affichage.
export const SUPPORTERS_REACTIONS = ["😂", "🔥", "⚽", "🤡", "❤️"] as const;

// ─── Prix VAR (marque maison) ─────────────────────────────────────────────────
// Catégories AUTO calculées depuis les réactions/commentaires (les
// self-réactions et auto-commentaires sont exclus). En plus du podium par votes.
// ⚠️ DÉSACTIVÉ (décision produit) : les Prix VAR sont décernés MANUELLEMENT par
// le jury (cf. VAR_MANUAL_CATEGORIES), pas dérivés automatiquement des réactions.
// Les réactions emoji restent (engagement), mais ne donnent plus de prix auto.
export const VAR_CATEGORIES: { key: string; emoji: string; label: string; source: "reaction" | "comments" }[] = [];

// Prix VAR décernés MANUELLEMENT par le jury (Marie & Vincent). Choix humain,
// PAS d'automatique : ce sont les seuls prix VAR du concours déguisements.
export const VAR_MANUAL_CATEGORIES: { key: string; emoji: string; label: string }[] = [
  { key: "m_deguisement", emoji: "🏆", label: "Prix VAR du plus beau déguisement" },
  { key: "m_drole",       emoji: "😂", label: "Prix VAR le plus drôle" },
  { key: "m_improbable",  emoji: "🤯", label: "Prix VAR le plus improbable" },
  { key: "m_esprit",      emoji: "🤝", label: "Prix VAR du meilleur esprit d'équipe" },
  { key: "m_coeur",       emoji: "❤️", label: "Prix VAR coup de cœur" },
];

// ─── Push supporter ───────────────────────────────────────────────────────────
// Le code des notifications (nouvelle photo → tout le monde ; commentaire → le
// binôme) est EN PLACE mais désactivé : on bascule à `true` quand on veut les
// activer, sans toucher au reste.
export const SUPPORTERS_PUSH_ENABLED = false;
