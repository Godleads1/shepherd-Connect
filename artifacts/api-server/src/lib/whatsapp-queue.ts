import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { createNotificationDelivery } from "../services/notificationOutbox";

// This module deliberately contains no sender. whatsapp_broadcasts and
// whatsapp_queue_items predate notification_outbox and are retained only as
// history while installations transition to the outbox worker.

const TITLE_MAX_LENGTH = 255;
const MESSAGE_MAX_LENGTH = 8192;

type LegacyItem = {
  broadcastId: string;
  userId: number;
  context: string | null;
  title: string | null;
  message: string | null;
  processedAt: Date | null;
};

function boundedLegacyText(value: string | null, limit: number, fallback: string): string {
  // PostgreSQL text can contain NUL only through an unusual import, but remove
  // it here before it becomes JSON/provider-bound content.
  const text = (value ?? fallback).replace(/\0/g, "");
  return text.slice(0, limit) || fallback;
}

function legacyIdentity(item: LegacyItem): string {
  // Broadcast ids are UUIDs in the legacy schema, so this stays well below the
  // createNotificationDelivery logical identity bound and is stable on reruns.
  return `legacy-whatsapp:${item.broadcastId}:recipient:${item.userId}`;
}

/**
 * Atomically moves every legacy pending item to notification_outbox.  An item
 * whose old sender had set processed_at crossed the provider-call boundary;
 * it is represented as terminal `uncertain`, never delivered again.  An
 * unclaimed item is ordinary pending outbox work.
 *
 * The transaction lock makes startup calls from multiple API processes safe;
 * the outbox logical key additionally makes this safe to re-run after any
 * interrupted deployment.
 */
export async function migrateLegacyWhatsAppQueue(): Promise<void> {
  try {
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('legacy-whatsapp-outbox-migration-v1'))`);
      const result = await tx.execute(sql`
        SELECT q.broadcast_id AS "broadcastId", q.user_id AS "userId",
          b.context, b.title, b.message, q.processed_at AS "processedAt"
        FROM whatsapp_queue_items q
        JOIN whatsapp_broadcasts b ON b.id = q.broadcast_id
        WHERE q.status = 'pending'
        FOR UPDATE OF q, b
      `);
      const items = result.rows as LegacyItem[];
      if (!items.length) return;

      for (const item of items) {
        const identity = legacyIdentity(item);
        const title = boundedLegacyText(item.title, TITLE_MAX_LENGTH, "Church notification");
        const message = boundedLegacyText(item.message, MESSAGE_MAX_LENGTH, "You have a church notification.");
        await createNotificationDelivery(tx, {
          logicalIdentity: identity,
          domainType: "legacy_whatsapp_broadcast",
          domainIdentifier: item.broadcastId,
          projection: {
            userId: item.userId,
            type: "broadcast",
            title,
            message,
            metadata: { legacyBroadcastId: item.broadcastId, legacyContext: item.context ?? null, migrated: true },
          },
          channels: ["whatsapp"],
          templateKey: "legacy_broadcast",
          templateMetadata: { legacyBroadcastId: item.broadcastId, migrated: true },
        });

        if (item.processedAt) {
          // The old sender claimed before dispatching. Its final provider state
          // is unknowable after a crash, so terminal uncertainty is required.
          await tx.execute(sql`
            UPDATE notification_outbox
            SET status = 'uncertain', claim_token = NULL, lease_expires_at = NULL,
              failure_classification = 'legacy_claimed_unfinalized',
              failure_detail = 'Legacy queue item was claimed before migration; provider acceptance is unknown.',
              finalized_at = now(), updated_at = now()
            WHERE logical_dedup_key = ${`${identity}:whatsapp`}
              AND status IN ('pending', 'retryable', 'processing')
          `);
        }

        // The legacy schema has no migrated status. skipped/failed are its
        // terminal history markers; the outbox row is authoritative from here.
        await tx.execute(sql`
          UPDATE whatsapp_queue_items
          SET status = ${item.processedAt ? "failed" : "skipped"}
          WHERE broadcast_id = ${item.broadcastId} AND user_id = ${item.userId}
            AND status = 'pending'
        `);
      }

      for (const broadcastId of new Set(items.map(item => item.broadcastId))) {
        await tx.execute(sql`
          UPDATE whatsapp_broadcasts b
          SET status = 'completed', completed_at = COALESCE(completed_at, now()),
            delivered_count = (SELECT count(*) FROM whatsapp_queue_items q WHERE q.broadcast_id = b.id AND q.status = 'delivered'),
            failed_count = (SELECT count(*) FROM whatsapp_queue_items q WHERE q.broadcast_id = b.id AND q.status = 'failed'),
            skipped_count = (SELECT count(*) FROM whatsapp_queue_items q WHERE q.broadcast_id = b.id AND q.status = 'skipped')
          WHERE b.id = ${broadcastId} AND NOT EXISTS (
            SELECT 1 FROM whatsapp_queue_items q WHERE q.broadcast_id = b.id AND q.status = 'pending'
          )
        `);
      }
      logger.info({ count: items.length }, "Migrated legacy WhatsApp queue items into notification outbox");
    });
  } catch (err) {
    // Do not start delivery until this succeeds; callers intentionally receive
    // the error so pending legacy recipients cannot be silently stranded.
    logger.error({ err }, "Legacy WhatsApp queue migration failed");
    throw err;
  }
}

/**
 * Compatibility export for older startup callers. It now migrates only and
 * never invokes a provider.
 */
export const recoverPendingQueue = migrateLegacyWhatsAppQueue;

/**
 * Legacy enqueueing is retired. Active routes must create notification
 * projections and outbox rows in their domain transaction instead.
 */
export function enqueueWhatsAppBroadcast(
  _recipients: { id: number }[],
  _title: string,
  _message: string,
  context: string,
): void {
  logger.warn({ context }, "Ignored retired legacy WhatsApp enqueue request");
}