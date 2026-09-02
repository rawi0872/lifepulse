import AsyncStorage from "@react-native-async-storage/async-storage";

const REMEMBERED_EMAIL_KEY = "lifepulse.remembered_email";

export function normalizeEmail(email: string): string {
  return email.trim();
}

export async function getRememberedEmail(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (!value) return null;
    const email = normalizeEmail(value);
    return email.length > 0 ? email : null;
  } catch {
    return null;
  }
}

export async function setRememberedEmail(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  try {
    await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, normalized);
  } catch {
    // Non-fatal: remembering the email is best-effort and never blocks sign-in.
  }
}