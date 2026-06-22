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
// Jeudi 25 juin 2026 à 23:59:59 (heure de Paris, CEST = UTC+2).
export const VOTES_CLOSE_AT = "2026-06-25T23:59:59+02:00";

export function votesClosed(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(VOTES_CLOSE_AT).getTime();
}

// ─── Ouverture des publications ───────────────────────────────────────────────
// Les binômes ne peuvent publier (photo OU vidéo) qu'à partir du mardi 23/06.
export const PUBLISH_OPEN_AT = "2026-06-23T08:00:00+02:00";

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
export const VAR_CATEGORIES: { key: string; emoji: string; label: string; source: "reaction" | "comments" }[] = [
  { key: "fou_rire", emoji: "😂", label: "VAR Fou rire", source: "reaction" },
  { key: "ambiance", emoji: "🔥", label: "VAR Ambiance", source: "reaction" },
  { key: "esprit_foot", emoji: "⚽", label: "VAR Esprit foot", source: "reaction" },
  { key: "nimporte_quoi", emoji: "🤡", label: "VAR N'importe quoi", source: "reaction" },
  { key: "coup_de_coeur", emoji: "❤️", label: "Coup de cœur", source: "reaction" },
  { key: "plus_commentee", emoji: "💬", label: "Photo la plus commentée", source: "comments" },
];

// Prix VAR décernés MANUELLEMENT par le jury (Marie/Vincent) — en plus des
// prix auto. Permettent de corriger un effet de popularité (créativité, esprit…).
export const VAR_MANUAL_CATEGORIES: { key: string; emoji: string; label: string }[] = [
  { key: "m_creativite", emoji: "🎨", label: "VAR Créativité" },
  { key: "m_canalplus", emoji: "📺", label: "VAR Canal+" },
  { key: "m_fou_rire", emoji: "😂", label: "VAR Fou rire (Jury)" },
  { key: "m_coeur", emoji: "💛", label: "Coup de cœur du jury" },
];

// ─── Push supporter ───────────────────────────────────────────────────────────
// Le code des notifications (nouvelle photo → tout le monde ; commentaire → le
// binôme) est EN PLACE mais désactivé : on bascule à `true` quand on veut les
// activer, sans toucher au reste.
export const SUPPORTERS_PUSH_ENABLED = false;
