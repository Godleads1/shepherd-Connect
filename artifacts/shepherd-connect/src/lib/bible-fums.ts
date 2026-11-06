/**
 * API.Bible Fair Use (FUMS) reporting — a licence requirement for web apps.
 * Each time Scripture text is shown we report the `fumsToken` that came with
 * it. Uses the documented manual endpoint via an image beacon so it works on
 * old smart-TV browsers and needs no third-party script. No personal data is
 * sent: the device and session IDs are random.
 */

const FUMS_URL = "https://fums.api.bible/f3";
const DEVICE_KEY = "bible-fums-device";

/** 128-bit random hex ID from the browser's cryptographic generator
 *  (crypto.getRandomValues, available on old smart-TV browsers too). */
export function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
  return out;
}

let sessionId: string | null = null;

function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const created = randomId();
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

export function fumsReportUrl(token: string, device: string, session: string): string {
  return `${FUMS_URL}?t=${encodeURIComponent(token)}&dId=${encodeURIComponent(device)}&sId=${encodeURIComponent(session)}`;
}

export function reportBibleView(token: string | null | undefined): void {
  if (!token || typeof Image === "undefined") return;
  try {
    if (!sessionId) sessionId = randomId();
    const beacon = new Image();
    beacon.referrerPolicy = "no-referrer";
    beacon.src = fumsReportUrl(token, deviceId(), sessionId);
  } catch {
    // Reporting must never interfere with showing the verse.
  }
}
