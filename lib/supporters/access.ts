// Accès BETA à la Journée Supporters — réservé le temps du test à quelques
// comptes + aux admins. Pur (client + serveur), aucune dépendance serveur.
// Pour ouvrir au public : vider SUPPORTERS_BETA_EMAILS et retirer le gating
// dans app/supporters/page.tsx + l'entrée de menu (components/layout/TopBar.tsx).

export const SUPPORTERS_BETA_EMAILS: string[] = [
  "marie.lucas@canal-plus.com",
  "vincent.trouillat@canal-plus.com",
];

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
// Jeudi 25 juin 2026 à 23:59:59 (heure de Paris, CEST = UTC+2).
export const VOTES_CLOSE_AT = "2026-06-25T23:59:59+02:00";

export function votesClosed(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(VOTES_CLOSE_AT).getTime();
}
