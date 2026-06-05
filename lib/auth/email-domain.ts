export const REQUIRED_EMAIL_DOMAIN = "canal-plus.com";
export const REQUIRED_EMAIL_SUFFIX = `@${REQUIRED_EMAIL_DOMAIN}`;
export const REQUIRED_EMAIL_MESSAGE = `Utilise une adresse ${REQUIRED_EMAIL_SUFFIX}.`;
export const ADMIN_EMAIL_EXEMPTIONS = new Set(["trouillatv@gmail.com"]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isRequiredEmailDomain(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (ADMIN_EMAIL_EXEMPTIONS.has(normalized)) return true;
  return /^[^@\s]+@canal-plus\.com$/.test(normalized);
}
