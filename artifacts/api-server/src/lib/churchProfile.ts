import { eq } from "drizzle-orm";
import { db, churchSettingsTable } from "@workspace/db";

/**
 * Everything that identifies one church's deployment.
 *
 * Shepherd Connect runs as one deployment per church. Identity that is fixed
 * per deployment (web address, logo, senders, colours) comes from environment
 * variables; things a Super Admin edits in Settings (church name, address,
 * service labels) come from the church_settings row and override the
 * environment defaults. Defaults reproduce the original church exactly, so a
 * deployment with none of these variables set behaves as before.
 */

const env = (name: string, fallback: string) => {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
};

function hhmm(name: string, fallback: string): string {
  const value = env(name, fallback);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

export const deploymentProfile = {
  appName: env("APP_NAME", "Shepherd Connect"),
  churchName: env("CHURCH_NAME", "RCCG City of David"),
  churchShortName: env("CHURCH_SHORT_NAME", "City of David"),
  /** Full denomination name shown above the logo on the sign-in page (empty to hide). */
  denominationName: env("CHURCH_DENOMINATION", "THE REDEEMED CHRISTIAN CHURCH OF GOD"),
  ministryName: env("CHURCH_MINISTRY_NAME", "Junior Church"),
  locality: env("CHURCH_LOCALITY", "Victoria Island"),
  address: env("CHURCH_ADDRESS", "Victoria Island, Lagos"),
  mapsUrl: env("CHURCH_MAPS_URL", "https://maps.app.goo.gl/uvgtpVETsCeqkzmDA"),
  tagline: env("CHURCH_TAGLINE", "Safe. Known. Celebrated."),
  /** Logo shown in the web app (path on the web app or absolute URL). */
  logoUrl: env("CHURCH_LOGO_URL", "/rccg-logo-new.png"),
  /** Logo in emails; must be an absolute URL that email clients can load. */
  emailLogoUrl: env("CHURCH_EMAIL_LOGO_URL", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/RCCG_logo.png/120px-RCCG_logo.png"),
  brandColor: env("CHURCH_BRAND_COLOR", "#1e3a8a"),
  /** Public web address of this church's app, without a trailing slash. */
  appUrl: env("APP_URL", "https://shepherdconnect.intelyticslimited.com").replace(/\/+$/, ""),
  emailFrom: env("EMAIL_FROM", "Shepherd Connect <noreply@shepherdconnect.intelyticslimited.com>"),
  /** Start times (24h, church local time) used to schedule reminders and checks. */
  service1Start: hhmm("SERVICE_1_START", "07:00"),
  service2Start: hhmm("SERVICE_2_START", "10:30"),
  service1Label: env("SERVICE_1_LABEL", "1st Service"),
  service2Label: env("SERVICE_2_LABEL", "2nd Service"),
  /** Service names used in messages to parents ("checked out from First Service"). */
  service1MessageName: env("SERVICE_1_MESSAGE_NAME", "First Service"),
  service2MessageName: env("SERVICE_2_MESSAGE_NAME", "Second Service"),
  service1TimeText: env("SERVICE_1_TIME_TEXT", "7:00 – 10:00 AM"),
  service2TimeText: env("SERVICE_2_TIME_TEXT", "10:30 AM onwards"),
};

export type ChurchProfile = typeof deploymentProfile;

let cached: { value: ChurchProfile; at: number } | null = null;
const CACHE_MS = 60_000;

/** Merge admin-edited settings over the deployment defaults (cached for a minute). */
export async function getChurchProfile(): Promise<ChurchProfile> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  let value: ChurchProfile = { ...deploymentProfile };
  try {
    const [row] = await db.select().from(churchSettingsTable).where(eq(churchSettingsTable.id, 1));
    if (row) {
      value = {
        ...value,
        churchName: row.churchName?.trim() || value.churchName,
        address: row.address?.trim() || value.address,
        mapsUrl: row.mapsUrl?.trim() || value.mapsUrl,
        service1Label: row.serviceSlot1Label?.trim() || value.service1Label,
        service2Label: row.serviceSlot2Label?.trim() || value.service2Label,
        service1TimeText: row.serviceSlot1Time?.trim() || value.service1TimeText,
        service2TimeText: row.serviceSlot2Time?.trim() || value.service2TimeText,
      };
    }
  } catch {
    // Settings unavailable (e.g. DB blip): fall back to deployment defaults.
  }
  cached = { value, at: Date.now() };
  return value;
}

/** Synchronous view for code paths that cannot await (last known profile). */
export function churchProfileSync(): ChurchProfile {
  return cached?.value ?? deploymentProfile;
}

/** Mark stale so the next read reloads; sync readers keep the last value meanwhile. */
export function invalidateChurchProfile(): void {
  if (cached) cached = { ...cached, at: 0 };
}

/** "7am" | "10:30am" are internal slot IDs meaning first / second service. */
export function serviceStartLabel(slot: string, profile: ChurchProfile = churchProfileSync()): string {
  const start = slot === "7am" ? profile.service1Start : slot === "10:30am" ? profile.service2Start : null;
  if (!start) return slot;
  const [h, m] = start.split(":").map(Number) as [number, number];
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function serviceName(slot: string, profile: ChurchProfile = churchProfileSync()): string {
  return slot === "7am" ? profile.service1MessageName : slot === "10:30am" ? profile.service2MessageName : slot;
}

/** Fields the web app needs before sign-in (no secrets). */
export function publicChurchProfile(profile: ChurchProfile) {
  const { emailFrom: _emailFrom, ...rest } = profile;
  return rest;
}
