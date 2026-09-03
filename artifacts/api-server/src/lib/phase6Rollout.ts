import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

function normalizeNigerianE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const national = digits.startsWith("0") ? digits.slice(1) : digits.startsWith("234") ? digits.slice(3) : "";
  return /^(?:7|8|9)\d{9}$/.test(national) ? `+234${national}` : null;
}

/**
 * Additive rollout for pre-Phase-6 phone identities. Only unambiguous valid
 * Nigerian numbers are canonicalized. Verification evidence is deliberately
 * untouched: formatting a number is not proof that its owner controls it.
 * Ambiguous duplicate legacy variants remain usable through the compatibility
 * lookup until an operator resolves them, rather than risking a failed startup
 * or silently revoking access.
 */
export async function backfillLegacyPhoneIdentities(): Promise<void> {
  // Explicit additive migration for existing development databases. It is
  // idempotent and happens before webhook processing can rely on a lease.
  await db.execute(sql`
    ALTER TABLE bot_inbound_events
      ADD COLUMN IF NOT EXISTS processing_started_at timestamptz NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS completed_at timestamptz
  `);
  const users = await db.select({ id: usersTable.id, phone: usersTable.phone }).from(usersTable);
  const candidates = users.flatMap(user => {
    const canonical = user.phone ? normalizeNigerianE164(user.phone) : null;
    return canonical && canonical !== user.phone ? [{ id: user.id, canonical }] : [];
  });
  const counts = new Map<string, number>();
  for (const candidate of candidates) counts.set(candidate.canonical, (counts.get(candidate.canonical) ?? 0) + 1);
  for (const candidate of candidates) {
    if (counts.get(candidate.canonical) !== 1) continue;
    // This update intentionally does not modify whatsapp_verified,
    // whatsapp_verified_at, or contact_version.
    await db.update(usersTable).set({ phone: candidate.canonical }).where(eq(usersTable.id, candidate.id));
  }
  const ambiguous = candidates.length - [...counts.values()].filter(count => count === 1).length;
  if (ambiguous) logger.warn({ ambiguous }, "Phase 6 phone rollout left ambiguous legacy phone variants unchanged");
}
