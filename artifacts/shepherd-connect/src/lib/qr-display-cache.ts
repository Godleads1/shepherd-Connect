// Keeps an issued attendance QR visible on the device that issued it until its
// sign-in time is over. The server stores only a digest of each code, so this
// device-local copy is the only way to show the same code again after a reload.
// Entries are deleted on expiry, when closed on this device, and on sign-out;
// they are hidden whenever the server reports a different (or no) active code.

const PREFIX = "shepherd_qr_display:";

type Entry<T> = { v: 1; expiresAt: number; fingerprint: string; payload: T };

export function saveQrDisplay<T>(key: string, payload: T, fingerprint: string | null | undefined, expiresAt: number, now = Date.now()): void {
  if (!fingerprint || !(expiresAt > now)) return;
  const entry: Entry<T> = { v: 1, expiresAt, fingerprint, payload };
  try { localStorage.setItem(PREFIX + key, JSON.stringify(entry)); } catch { /* storage unavailable or full */ }
}

/**
 * Returns the saved payload only while it is unexpired and still matches the
 * server's current active code; null from the server means no active code.
 */
export function readQrDisplay<T>(key: string, currentFingerprint: string | null | undefined, now = Date.now()): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<Entry<T>> | null;
    const valid = entry?.v === 1 && typeof entry.expiresAt === "number" && entry.expiresAt > now
      && typeof entry.fingerprint === "string" && "payload" in entry;
    if (!valid) { localStorage.removeItem(PREFIX + key); return null; }
    // A mismatch hides the code but keeps it: the caller's server data may be
    // older than a code issued moments ago in another tab on this device.
    return entry.fingerprint === currentFingerprint ? entry.payload as T : null;
  } catch {
    clearQrDisplay(key);
    return null;
  }
}

export function clearQrDisplay(key: string): void {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

/** Removes every saved QR (used when the session ends). */
export function clearAllQrDisplays(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/** Midnight at the end of a YYYY-MM-DD service date in Lagos (WAT, UTC+01:00, no DST), as epoch ms. */
export function endOfLagosDay(serviceDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(serviceDate);
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  return Date.UTC(y, mo - 1, d + 1) - 3600_000;
}

export const meetingQrKey = (meetingId: number) => `meeting:${meetingId}`;
export const sundayQrKey = (serviceDate: string) => `sunday:${serviceDate}`;
