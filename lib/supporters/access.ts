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
