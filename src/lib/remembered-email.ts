// Remembered email (parity with mobile lib/remembered-email).
// Prefills sign-in; never stores passwords. Best-effort, never blocks auth.
const REMEMBERED_EMAIL_KEY = "lifepulse.remembered_email";

export function normalizeEmail(email: string): string {
  return email.trim();
}

export function getRememberedEmail(): string | null {
  try {
    const value = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (!value) return null;
    const email = normalizeEmail(value);
    return email.length > 0 ? email : null;
  } catch {
    return null;
  }
}

export function setRememberedEmail(email: string): void {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  try {
    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, normalized);
  } catch {
    // Non-fatal: remembering the email never blocks sign-in.
  }
}
