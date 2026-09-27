// Liste blanche admin — pure, sans dépendance Next (next/headers, next/server),
// pour rester importable depuis un contexte node --test (voir cs-guard.ts,
// cs-guard.test.ts) sans tirer la chaîne createClient()/cookies() de
// lib/auth/admin.ts. Source de vérité unique, réutilisée par lib/auth/admin.ts
// (voie legacy Canal Cup) et lib/auth/cs-guard.ts (requireCsAdmin, CANAL Sports).

// Admins (co-organisateurs). trouillatv = Vincent (super_admin) ;
// marie.lucas = Marie (co-organisatrice).
const DEFAULT_ADMIN_EMAILS = ["trouillatv@gmail.com", "vincent.trouillat@canal-plus.com", "marie.lucas@canal-plus.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowEnv = (process.env.ADMIN_EMAILS ?? "").trim();
  const allow = (allowEnv.length > 0 ? allowEnv.split(",") : DEFAULT_ADMIN_EMAILS).map((s) =>
    s.trim().toLowerCase()
  );
  return allow.includes(email.toLowerCase());
}
