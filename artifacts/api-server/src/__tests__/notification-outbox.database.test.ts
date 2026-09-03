import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  claimNotifications, createNotificationDelivery, enqueueNotification, finalizeNotification,
} from "../services/notificationOutbox";
import { cleanupNotificationDeliveryHistory } from "../services/notificationDeliveryWorker";

const databaseDescribe = process.env.RUN_DATABASE_OUTBOX_TESTS === "true" ? describe : describe.skip;
const prefix = `outbox-db-${Date.now()}`;
let userId = 0;

function input(key: string) {
  return {
    logicalDedupKey: `${prefix}-${key}`, notificationType: "test", domainType: "test",
    domainIdentifier: key, recipientUserId: userId, channel: "email" as const,
    templateKey: "test-template", templateMetadata: { key }, payload: { key },
  };
}

async function count(key?: string) {
  const result = await db.execute(sql`
    SELECT count(*)::int AS count FROM notification_outbox
    WHERE logical_dedup_key LIKE ${key ? `${prefix}-${key}` : `${prefix}%`}
  `);
  return Number((result.rows[0] as { count: number }).count);
}

function claimOwn() {
  return claimNotifications(db, { limit: 100, logicalDedupKeyPrefix: `${prefix}%` });
}

databaseDescribe("notification outbox PostgreSQL ownership", () => {
  beforeAll(async () => {
    const result = await db.execute(sql`
      INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_active)
      VALUES (${`${prefix}@example.test`}, 'unused', 'Outbox', 'Test', 'parent', 'active', true)
      RETURNING id
    `);
    userId = Number((result.rows[0] as { id: number }).id);
  });

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM notification_outbox WHERE logical_dedup_key LIKE ${`${prefix}%`}`);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM notification_outbox WHERE logical_dedup_key LIKE ${`${prefix}%`}`);
    await db.execute(sql`DELETE FROM notifications WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
  });

  it("rolls back the enqueue with its enclosing domain transaction", async () => {
    await expect(db.transaction(async tx => {
      await enqueueNotification(tx, input("rollback"));
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    expect(await count("rollback")).toBe(0);
  });

  it("deduplicates concurrent logical enqueues", async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => enqueueNotification(db, input("dedup"))));
    expect(new Set(results.map(result => result.id)).size).toBe(1);
    expect(results.filter(result => result.inserted).length).toBe(1);
    expect(await count("dedup")).toBe(1);
  });

  it("creates one projection and one channel row for a repeated logical operation", async () => {
    const identity = `${prefix}-projection-duplicate`;
    const delivery = () => db.transaction(tx => createNotificationDelivery(tx, {
        logicalIdentity: identity, domainType: "test", domainIdentifier: identity,
        projection: { userId, type: "test", title: "Test", message: "Test message" },
        channels: ["whatsapp"], templateKey: "test",
      }));
    const [first, repeated] = await Promise.all([delivery(), delivery()]);
    expect(first.notificationId).toBe(repeated.notificationId);
    const outboxCount = await db.execute(sql`SELECT count(*)::int AS count FROM notification_outbox WHERE logical_dedup_key = ${`${identity}:whatsapp`}`);
    const projectionCount = await db.execute(sql`SELECT count(*)::int AS count FROM notifications WHERE id = ${first.notificationId}`);
    expect(Number((outboxCount.rows[0] as { count: number }).count)).toBe(1);
    expect(Number((projectionCount.rows[0] as { count: number }).count)).toBe(1);
    await db.execute(sql`DELETE FROM notifications WHERE id = ${first.notificationId}`);
  });

  it("deduplicates a repeated late-pickup child/recipient/date/slot operation", async () => {
    const identity = `${prefix}-late-pickup:child:1:recipient:${userId}:2026-08-23:7am`;
    const insert = () => db.transaction(tx => createNotificationDelivery(tx, {
        logicalIdentity: identity, domainType: "late_pickup", domainIdentifier: "1:2026-08-23:7am",
        projection: { userId, type: "late_pickup_reminder", title: "Late Pickup", message: "Please collect." },
        channels: ["whatsapp"],
      }));
    const [a, b] = await Promise.all([insert(), insert()]);
    expect(a.notificationId).toBe(b.notificationId);
  });

  it("deduplicates a repeated broadcast recipient operation", async () => {
    const identity = `${prefix}-broadcast:operation-1:recipient:${userId}`;
    const insert = () => db.transaction(tx => createNotificationDelivery(tx, {
        logicalIdentity: identity, domainType: "broadcast", domainIdentifier: "operation-1",
        projection: { userId, type: "broadcast", title: "Notice", message: "Message" }, channels: ["whatsapp"],
      }));
    const [a, b] = await Promise.all([insert(), insert()]);
    expect(a.notificationId).toBe(b.notificationId);
  });

  it("gives concurrent workers one owner and rejects a stale claimant", async () => {
    await enqueueNotification(db, input("claim"));
    const [first, second] = await Promise.all([claimOwn(), claimOwn()]);
    const claim = [...first, ...second];
    expect(claim).toHaveLength(1);
    await db.execute(sql`UPDATE notification_outbox SET lease_expires_at = now() - interval '1 second' WHERE id = ${claim[0].id}::uuid`);
    const replacement = (await claimOwn()).find(row => row.id === claim[0].id)!;
    expect(replacement.id).toBe(claim[0].id);
    expect(replacement.claimToken).not.toBe(claim[0].claimToken);
    expect(await finalizeNotification(db, { ...claim[0], outcome: "accepted" })).toBe(false);
  });

  it("retries, dead-letters the fifth failed claim, and never blindly retries uncertain work", async () => {
    await enqueueNotification(db, input("retry"));
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const claim = (await claimOwn()).find(row => row.logicalDedupKey === input("retry").logicalDedupKey)!;
      expect(claim.attempts).toBe(attempt);
      await finalizeNotification(db, { ...claim, outcome: "retryable", failureClassification: "provider_rejected" });
      if (attempt < 5) {
        await db.execute(sql`UPDATE notification_outbox SET next_attempt_at = now() - interval '1 second' WHERE id = ${claim.id}::uuid`);
      }
    }
    const status = await db.execute(sql`SELECT status FROM notification_outbox WHERE logical_dedup_key = ${input("retry").logicalDedupKey}`);
    expect((status.rows[0] as { status: string }).status).toBe("dead_letter");

    await enqueueNotification(db, input("uncertain"));
    const uncertain = (await claimOwn()).find(row => row.logicalDedupKey === input("uncertain").logicalDedupKey)!;
    await finalizeNotification(db, { ...uncertain, outcome: "uncertain", failureClassification: "provider_timeout" });
    expect((await claimOwn()).find(row => row.id === uncertain.id)).toBeUndefined();
  });

  it("cleans up only aged terminal outbox rows and aged expired or consumed SSE tickets", async () => {
    const keys = {
      oldTerminal: `${prefix}-retention-old-terminal`,
      recentTerminal: `${prefix}-retention-recent-terminal`,
      pending: `${prefix}-retention-pending`,
      retryable: `${prefix}-retention-retryable`,
    };
    for (const logicalDedupKey of Object.values(keys)) {
      await enqueueNotification(db, {
        ...input(`unused-${logicalDedupKey}`),
        logicalDedupKey,
      });
    }
    await db.execute(sql`
      UPDATE notification_outbox
      SET status = 'accepted', finalized_at = now() - interval '91 days'
      WHERE logical_dedup_key = ${keys.oldTerminal}
    `);
    await db.execute(sql`
      UPDATE notification_outbox
      SET status = 'skipped', finalized_at = now() - interval '89 days'
      WHERE logical_dedup_key = ${keys.recentTerminal}
    `);
    await db.execute(sql`
      UPDATE notification_outbox
      SET status = 'pending', finalized_at = now() - interval '91 days'
      WHERE logical_dedup_key = ${keys.pending}
    `);
    await db.execute(sql`
      UPDATE notification_outbox
      SET status = 'retryable', finalized_at = now() - interval '91 days'
      WHERE logical_dedup_key = ${keys.retryable}
    `);

    const ticketHashes = {
      oldExpired: `${prefix}-old-expired`.padEnd(64, "0").slice(0, 64),
      oldConsumed: `${prefix}-old-consumed`.padEnd(64, "0").slice(0, 64),
      freshExpired: `${prefix}-fresh-expired`.padEnd(64, "0").slice(0, 64),
      freshConsumed: `${prefix}-fresh-consumed`.padEnd(64, "0").slice(0, 64),
      active: `${prefix}-active`.padEnd(64, "0").slice(0, 64),
    };
    await db.execute(sql`
      INSERT INTO sse_tickets (ticket_hash, user_id, selected_role, purpose, expires_at, consumed_at)
      VALUES
        (${ticketHashes.oldExpired}, ${userId}, 'parent', 'sse', now() - interval '2 days', NULL),
        (${ticketHashes.oldConsumed}, ${userId}, 'parent', 'sse', now() + interval '1 day', now() - interval '2 days'),
        (${ticketHashes.freshExpired}, ${userId}, 'parent', 'sse', now() - interval '1 hour', NULL),
        (${ticketHashes.freshConsumed}, ${userId}, 'parent', 'sse', now() + interval '1 day', now() - interval '1 hour'),
        (${ticketHashes.active}, ${userId}, 'parent', 'sse', now() + interval '1 day', NULL)
    `);

    try {
      await cleanupNotificationDeliveryHistory();
      const outbox = await db.execute(sql`
        SELECT logical_dedup_key FROM notification_outbox
        WHERE logical_dedup_key IN (${keys.oldTerminal}, ${keys.recentTerminal}, ${keys.pending}, ${keys.retryable})
      `);
      expect((outbox.rows as Array<{ logical_dedup_key: string }>).map(row => row.logical_dedup_key).sort())
        .toEqual([keys.pending, keys.recentTerminal, keys.retryable].sort());

      const tickets = await db.execute(sql`
        SELECT ticket_hash FROM sse_tickets
        WHERE ticket_hash IN (${ticketHashes.oldExpired}, ${ticketHashes.oldConsumed}, ${ticketHashes.freshExpired},
          ${ticketHashes.freshConsumed}, ${ticketHashes.active})
      `);
      expect((tickets.rows as Array<{ ticket_hash: string }>).map(row => row.ticket_hash).sort())
        .toEqual([ticketHashes.active, ticketHashes.freshConsumed, ticketHashes.freshExpired].sort());
    } finally {
      await db.execute(sql`DELETE FROM sse_tickets WHERE ticket_hash LIKE ${`${prefix}%`}`);
    }
  });
});