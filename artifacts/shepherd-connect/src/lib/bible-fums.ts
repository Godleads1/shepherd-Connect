/**
 * API.Bible Fair Use (FUMS) reporting — a licence requirement for web apps.
 * Each time Scripture text is shown we report the `fumsToken` that came with
 * it. Uses the documented manual endpoint via an image beacon so it works on
 * old smart-TV browsers and needs no third-party script. No personal data is
 * sent: the device and session IDs are random.
 */

const FUMS_URL = "https://fums.api.bible/f3";
const DEVICE_KEY = "bible-fums-device";

function randomId(): string {
  let out = "";
  for (let i = 0; i < 4; i += 1) out += Math.random().toString(36).slice(2, 10);
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
  if (!sessionId) sessionId = randomId();
  try {
    const beacon = new Image();
    beacon.referrerPolicy = "no-referrer";
    beacon.src = fumsReportUrl(token, deviceId(), sessionId);
  } catch {
    // Reporting must never interfere with showing the verse.
  }
}
