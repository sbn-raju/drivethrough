/** Carries the "code sent to …" context between sign-up/login and the verification screen. */
export type PendingVerification = { identifier: string; destination: string; channel: 'email' | 'phone' };

const KEY = 'dt_pending_verification';

export function savePending(p: PendingVerification) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — router state still carries it */
  }
}

export function loadPending(fromState: unknown): PendingVerification | null {
  const s = fromState as Partial<PendingVerification> | null;
  if (s?.identifier && s.destination && s.channel) return s as PendingVerification;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingVerification) : null;
  } catch {
    return null;
  }
}

export function clearPending() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
