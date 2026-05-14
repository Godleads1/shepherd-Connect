import webpush from "web-push";
import type { Logger } from "pino";
import { db, pushSubscriptionsTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT ?? "mailto:admin@shepherd-connect.rccg";

function isConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

if (isConfigured()) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
}

async function sendToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  logger?: Logger,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
    return true;
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — delete it
      await db.delete(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
      logger?.info({ endpoint: sub.endpoint }, "Removed expired push subscription");
    } else {
      logger?.warn({ err: err.message, endpoint: sub.endpoint }, "Push send failed");
    }
    return false;
  }
}

/**
 * Send a push notification to a single user.
 */
export async function pushToUser(
  userId: number,
  payload: PushPayload,
  logger?: Logger,
): Promise<void> {
  if (!isConfigured()) return;
  const subs = await db.select().from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));
  await Promise.all(subs.map(s => sendToSubscription(s, payload, logger)));
}

/**
 * Send a push notification to multiple users at once.
 */
export async function pushToUsers(
  userIds: number[],
  payload: PushPayload,
  logger?: Logger,
): Promise<void> {
  if (!isConfigured() || userIds.length === 0) return;
  const subs = await db.select().from(pushSubscriptionsTable)
    .where(inArray(pushSubscriptionsTable.userId, userIds));
  await Promise.all(subs.map(s => sendToSubscription(s, payload, logger)));
}

/**
 * Send a push notification to all users with a given role.
 */
export async function pushToRole(
  role: string,
  payload: PushPayload,
  logger?: Logger,
): Promise<void> {
  if (!isConfigured()) return;
  const users = await db.select({ id: usersTable.id }).from(usersTable)
    .where(eq(usersTable.role, role as any));
  const ids = users.map(u => u.id);
  await pushToUsers(ids, payload, logger);
}

export const vapidPublicKey = VAPID_PUBLIC_KEY ?? "";
