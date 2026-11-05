// Meeting attendance helpers. Meeting times are always entered and shown in
// Africa/Lagos (WAT, UTC+01:00, no DST) — never the browser's local zone.

export const MEETING_TIME_ZONE = "Africa/Lagos";
export const PENDING_MEETING_TOKEN_KEY = "shepherd_pending_meeting_qr";
const TOKEN_SHAPE = /^([1-9]\d{0,9})\.([A-Za-z0-9_-]{43})$/;
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isMeetingToken(value: string): boolean {
  const m = TOKEN_SHAPE.exec(value);
  return !!m && Number(m[1]) <= 2147483647;
}

/** "2025-03-04T18:30" (WAT wall clock) -> UTC ISO "2025-03-04T17:30:00.000Z". */
export function watInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  const check = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return new Date(`${value.trim()}:00+01:00`).toISOString();
}

function lagosParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MEETING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = (t: Intl.DateTimeFormatPartTypes) => parts.find(x => x.type === t)?.value ?? "";
  return { y: p("year"), mo: p("month"), d: p("day"), h: p("hour"), mi: p("minute") };
}

/** ISO instant -> datetime-local value expressed in WAT. */
export function isoToWatInput(iso: string): string {
  const { y, mo, d, h, mi } = lagosParts(iso);
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

export function formatWatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MEETING_TIME_ZONE, weekday: "short", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso)) + " WAT";
}

export function formatWatWindow(startsAt: string, endsAt: string): string {
  const s = lagosParts(startsAt), e = lagosParts(endsAt);
  const sameDay = s.y === e.y && s.mo === e.mo && s.d === e.d;
  return sameDay
    ? `${formatWatDateTime(startsAt).replace(" WAT", "")}–${e.h}:${e.mi} WAT`
    : `${formatWatDateTime(startsAt)} to ${formatWatDateTime(endsAt)}`;
}

export function validateMeetingForm(title: string, startsAt: string, endsAt: string): string | null {
  const t = title.trim();
  if (!t) return "Enter a meeting title.";
  if (t.length > 120) return "Title must be 120 characters or fewer.";
  const s = watInputToIso(startsAt), e = watInputToIso(endsAt);
  if (!s || !e) return "Enter a valid start and end time.";
  const span = new Date(e).getTime() - new Date(s).getTime();
  if (span <= 0) return "End time must be after start time.";
  if (span > MAX_WINDOW_MS) return "A meeting window can be at most seven days.";
  return null;
}

/** Accepts a raw token or a meeting URL carrying #token=… ; returns null if not a meeting code. */
export function extractMeetingToken(raw: string): string | null {
  const value = raw.trim();
  if (isMeetingToken(value)) return value;
  const hashIdx = value.indexOf("#");
  if (hashIdx === -1) return null;
  const params = new URLSearchParams(value.slice(hashIdx + 1));
  const token = params.get("token");
  if (!token || !isMeetingToken(token)) return null;
  if (hashIdx > 0 && !/\/meeting-attendance\/?$/.test(value.slice(0, hashIdx).split("?")[0])) return null;
  return token;
}

export function buildMeetingQrUrl(origin: string, basePath: string, token: string): string {
  const base = basePath.replace(/\/+$/, "");
  return `${origin}${base}/meeting-attendance#token=${encodeURIComponent(token)}`;
}

export function savePendingMeetingToken(token: string): void {
  try { sessionStorage.setItem(PENDING_MEETING_TOKEN_KEY, token); } catch { /* storage unavailable */ }
}
export function readPendingMeetingToken(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_MEETING_TOKEN_KEY);
    return v && isMeetingToken(v) ? v : null;
  } catch { return null; }
}
export function clearPendingMeetingToken(): void {
  try { sessionStorage.removeItem(PENDING_MEETING_TOKEN_KEY); } catch { /* ignore */ }
}

/** Moves a #token= fragment into sessionStorage and strips it from the address bar. */
export function captureMeetingTokenFromHash(): string | null {
  if (typeof window === "undefined" || !window.location.hash) return null;
  const token = extractMeetingToken(window.location.hash);
  if (!token) return null;
  savePendingMeetingToken(token);
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  return token;
}

export function meetingErrorMessage(error: unknown, fallback: string): { status: number | null; message: string } {
  const e = error as { status?: number; data?: { message?: string; error?: string } | null; message?: string } | null;
  const status = typeof e?.status === "number" ? e.status : null;
  const server = e?.data?.message || e?.data?.error;
  return { status, message: server || (status ? fallback : e?.message || fallback) };
}

export function scanErrorCopy(status: number | null, serverMessage: string): { title: string; body: string } {
  if (status === 403) return { title: "You are not activated for this meeting", body: serverMessage };
  if (status === 409 || status === 410) return { title: "This meeting is not accepting sign-ins", body: serverMessage };
  if (status === 400 || status === 404 || status === 422) return { title: "This QR code is not valid", body: serverMessage };
  if (status === 401) return { title: "Please sign in again", body: serverMessage };
  return { title: "Sign-in could not be confirmed", body: serverMessage };
}
