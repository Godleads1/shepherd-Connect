import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";
import { ensureWhatsAppTables } from "./whatsappAuthStore";

/**
 * Exactly one API instance may hold the WhatsApp connection. Two instances on
 * the same WhatsApp login replace each other's connection until WhatsApp logs
 * the session out — the main way Baileys "kept failing" on Autoscale.
 *
 * A short database lease decides the owner. It is a table row rather than a
 * Postgres advisory lock so it also works through a connection pooler.
 */

export const LEASE_TTL_MS = 30_000;
export const RENEW_EVERY_MS = 10_000;
export const INSTANCE_ID = randomUUID();

type Executor = Pick<typeof db, "execute">;

/** Take the lease if it is free/expired, or renew it if already ours. */
export async function acquireOrRenewLease(holder: string, executor: Executor = db, ttlMs = LEASE_TTL_MS): Promise<boolean> {
  await ensureWhatsAppTables(executor);
  const result = await executor.execute(sql`
    INSERT INTO whatsapp_leader_lease (id, holder, expires_at)
    VALUES (1, ${holder}, now() + (${ttlMs} * interval '1 millisecond'))
    ON CONFLICT (id) DO UPDATE SET holder = EXCLUDED.holder, expires_at = EXCLUDED.expires_at
    WHERE whatsapp_leader_lease.holder = EXCLUDED.holder OR whatsapp_leader_lease.expires_at < now()
    RETURNING holder`);
  return result.rows.length === 1;
}

export async function releaseLease(holder: string, executor: Executor = db): Promise<void> {
  await executor.execute(sql`DELETE FROM whatsapp_leader_lease WHERE id = 1 AND holder = ${holder}`);
}

let leader = false;
let lastRenewedAt = 0;
let loop: NodeJS.Timeout | null = null;
let callbacks: { onBecomeLeader: () => void; onLoseLeader: () => void } | null = null;

export function isWhatsAppLeader(): boolean {
  return leader;
}

async function tick(): Promise<void> {
  try {
    const held = await acquireOrRenewLease(INSTANCE_ID);
    if (held) {
      lastRenewedAt = Date.now();
      if (!leader) {
        leader = true;
        logger.info({ instance: INSTANCE_ID }, "This instance now owns the WhatsApp connection");
        callbacks?.onBecomeLeader();
      }
    } else if (leader) {
      leader = false;
      logger.warn({ instance: INSTANCE_ID }, "Another instance took over WhatsApp — disconnecting here");
      callbacks?.onLoseLeader();
    }
  } catch (err) {
    // Can't reach the database. Keep the connection for now, but step down
    // once the lease could have expired, so a second instance taking over can
    // never overlap with this one.
    if (leader && Date.now() - lastRenewedAt > LEASE_TTL_MS - RENEW_EVERY_MS) {
      leader = false;
      logger.warn({ err: String(err) }, "Could not renew WhatsApp lease — disconnecting until the database is back");
      callbacks?.onLoseLeader();
    }
  }
}

export function startWhatsAppLeaderElection(handlers: { onBecomeLeader: () => void; onLoseLeader: () => void }): void {
  callbacks = handlers;
  if (loop) return;
  void tick();
  loop = setInterval(() => { void tick(); }, RENEW_EVERY_MS);
  loop.unref();
}

/** Try to become leader right now (e.g. a Super Admin pressing Connect). */
export async function claimWhatsAppLeadership(): Promise<boolean> {
  await tick();
  return leader;
}

/** On shutdown: hand the connection over immediately instead of after the TTL. */
export async function stopWhatsAppLeaderElection(): Promise<void> {
  if (loop) { clearInterval(loop); loop = null; }
  if (leader) {
    leader = false;
    await releaseLease(INSTANCE_ID).catch(() => {});
  }
}
