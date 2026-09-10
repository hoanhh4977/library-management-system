const STORAGE_KEY = "lms_pending_registration";

export interface PendingRegistration {
  fullName: string;
  dateOfBirth: string;
  phone: string;
}

/** Survives the full-page redirect Supabase does after the confirmation-link
 * click (component state doesn't) — read once by AuthConfirmPage, then cleared. */
export function savePendingRegistration(email: string, data: PendingRegistration) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, ...data }));
  } catch {
    // Best-effort only — AuthConfirmPage falls back to asking again if this is unavailable.
  }
}

export function readPendingRegistration(email: string): PendingRegistration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRegistration & { email: string };
    if (parsed.email !== email) return null;
    return { fullName: parsed.fullName, dateOfBirth: parsed.dateOfBirth, phone: parsed.phone };
  } catch {
    return null;
  }
}

export function clearPendingRegistration() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
