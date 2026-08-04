import { db, whatsappBroadcastsTable, whatsappQueueItemsTable } from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "./logger";
import { dispatchExternal } from "./notify";

const DELAY_MS = 220; // ~4.5 messages/second — safe for Baileys / WhatsApp unofficial API
const RECOVERY_AGE_MINUTES = 10; // items pending for longer than this are from a dead process

// ─── Internal sender ─────────────────────────────────────────────────────────

async function runQueue(
  broadcastId: string,
  recipients: { id: number }[],
  title: string,
  message: string,
  context: string,
): Promise<void> {
  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i]!;
    let itemStatus: "delivered" | "failed" | "skipped" = "skipped";

    try {
      const result = await dispatchExternal(recipient.id, title, message);
      itemStatus = result.delivered ? "delivered" : "skipped";
      if (result.delivered) delivered++;
      else skipped++;
    } catch {
      itemStatus = "failed";
      failed++;
    }

    // Mark this item done in DB
    await db
      .update(whatsappQueueItemsTable)
      .set({ status: itemStatus, processedAt: new Date() })
      .where(
        and(
          eq(whatsappQueueItemsTable.broadcastId, broadcastId),
          eq(whatsappQueueItemsTable.userId, recipient.id),
          eq(whatsappQueueItemsTable.status, "pending"),
        ),
      )
      .catch(() => { /* non-fatal — delivery already happened */ });

    // Throttle: wait between sends (skip after last item)
    if (i < recipients.length - 1) {
      await new Promise<void>(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  // Mark broadcast complete
  await db
    .update(whatsappBroadcastsTable)
    .set({
      deliveredCount: delivered,
      failedCount: failed,
      skippedCount: skipped,
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(whatsappBroadcastsTable.id, broadcastId))
    .catch(() => { /* non-fatal */ });

  const durationSec = ((recipients.length - 1) * DELAY_MS) / 1000;
  if (failed > 0) {
    logger.warn({ context, delivered, failed, skipped, total: recipients.length, durationSec },
      `${context}: WhatsApp queue finished — some deliveries failed`);
  } else {
    logger.info({ context, delivered, skipped, total: recipients.length, durationSec },
      `${context}: WhatsApp queue finished`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enqueue a WhatsApp broadcast. Persists all queue items to the DB before
 * starting so a server restart mid-send can recover pending items.
 * Returns immediately — delivery happens in the background.
 */
export function enqueueWhatsAppBroadcast(
  recipients: { id: number }[],
  title: string,
  message: string,
  context: string,
): void {
  if (recipients.length === 0) return;

  (async () => {
    try {
      // 1. Create the broadcast record
      const [broadcast] = await db
        .insert(whatsappBroadcastsTable)
        .values({ context, title, message, totalCount: recipients.length, status: "running" })
        .returning({ id: whatsappBroadcastsTable.id });

      if (!broadcast) return;

      // 2. Insert all queue items as "pending" so they survive a restart
      await db.insert(whatsappQueueItemsTable).values(
        recipients.map(r => ({ broadcastId: broadcast.id, userId: r.id, status: "pending" as const })),
      );

      // 3. Send
      await runQueue(broadcast.id, recipients, title, message, context);
    } catch (err) {
      logger.error({ err, context }, "WhatsApp queue: failed to initialise broadcast");
    }
  })();
}

// ─── Restart recovery ─────────────────────────────────────────────────────────

/**
 * Called on server startup. Finds broadcasts whose queue items are still
 * "pending" (left over from a previous process that died mid-send) and
 * re-enqueues them so no parent is silently missed.
 */
export async function recoverPendingQueue(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - RECOVERY_AGE_MINUTES * 60 * 1000);

    // Find broadcasts that are still "running" and old enough to be orphaned
    const stale = await db
      .select({
        id: whatsappBroadcastsTable.id,
        context: whatsappBroadcastsTable.context,
        title: whatsappBroadcastsTable.title,
        message: whatsappBroadcastsTable.message,
      })
      .from(whatsappBroadcastsTable)
      .where(
        and(
          eq(whatsappBroadcastsTable.status, "running"),
          lt(whatsappBroadcastsTable.createdAt, cutoff),
        ),
      );

    if (stale.length === 0) return;

    logger.info({ count: stale.length }, "WhatsApp queue: recovering orphaned broadcasts");

    for (const broadcast of stale) {
      // Fetch only the items that weren't processed yet
      const pending = await db
        .select({ userId: whatsappQueueItemsTable.userId })
        .from(whatsappQueueItemsTable)
        .where(
          and(
            eq(whatsappQueueItemsTable.broadcastId, broadcast.id),
            eq(whatsappQueueItemsTable.status, "pending"),
          ),
        );

      if (pending.length === 0) {
        // All items were processed — just mark the broadcast complete
        await db
          .update(whatsappBroadcastsTable)
          .set({
            status: "completed",
            completedAt: new Date(),
            deliveredCount: sql`(SELECT COUNT(*) FROM whatsapp_queue_items WHERE broadcast_id = ${broadcast.id} AND status = 'delivered')`,
            failedCount:   sql`(SELECT COUNT(*) FROM whatsapp_queue_items WHERE broadcast_id = ${broadcast.id} AND status = 'failed')`,
            skippedCount:  sql`(SELECT COUNT(*) FROM whatsapp_queue_items WHERE broadcast_id = ${broadcast.id} AND status = 'skipped')`,
          })
          .where(eq(whatsappBroadcastsTable.id, broadcast.id));
        continue;
      }

      logger.info({ broadcastId: broadcast.id, context: broadcast.context, pending: pending.length },
        "WhatsApp queue: re-enqueuing orphaned items");

      // Fire recovery in background — don't await so startup isn't delayed
      runQueue(broadcast.id, pending.map(p => ({ id: p.userId })), broadcast.title, broadcast.message, `${broadcast.context} (recovered)`)
        .catch(err => logger.error({ err, broadcastId: broadcast.id }, "WhatsApp queue: recovery runQueue failed"));
    }
  } catch (err) {
    logger.error({ err }, "WhatsApp queue: recoverPendingQueue failed — skipping");
  }
}
