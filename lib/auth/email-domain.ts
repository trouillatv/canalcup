export const REQUIRED_EMAIL_DOMAIN = "canal-plus.com";
export const REQUIRED_EMAIL_SUFFIX = `@${REQUIRED_EMAIL_DOMAIN}`;
export const REQUIRED_EMAIL_MESSAGE = `Utilise une adresse ${REQUIRED_EMAIL_SUFFIX}.`;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isRequiredEmailDomain(email: string): boolean {
  const normalized = normalizeEmail(email);
  return /^[^@\s]+@canal-plus\.com$/.test(normalized);
}
