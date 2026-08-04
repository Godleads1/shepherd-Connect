import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, notificationsTable, usersTable, churchSettingsTable } from "@workspace/db";
import { ListNotificationsQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { pushToUsers, pushToRole } from "../services/push";
import { dispatchExternal } from "../lib/notify";
import { pushEventToUsers } from "../lib/sse";

const LOCATION_DEFAULTS = {
  churchName: "RCCG City of David",
  address: "Victoria Island, Lagos",
  mapsUrl: "https://maps.app.goo.gl/uvgtpVETsCeqkzmDA",
};

async function getPickupLocation(): Promise<{ pickupAddress: string; mapsLink: string }> {
  try {
    const rows = await db.select().from(churchSettingsTable).where(eq(churchSettingsTable.id, 1));
    const row = rows[0];
    if (row) {
      return {
        pickupAddress: `${row.churchName}, ${row.address}`,
        mapsLink: row.mapsUrl,
      };
    }
  } catch {
    // fall through to defaults
  }
  return {
    pickupAddress: `${LOCATION_DEFAULTS.churchName}, ${LOCATION_DEFAULTS.address}`,
    mapsLink: LOCATION_DEFAULTS.mapsUrl,
  };
}

const router = Router();

router.get("/notifications", authMiddleware, async (req, res): Promise<void> => {
  const params = ListNotificationsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { unreadOnly, page = 1, limit = 20 } = params.data;
  const userId = req.user!.userId;
  const conditions = [eq(notificationsTable.userId, userId)];
  if (unreadOnly) conditions.push(eq(notificationsTable.readStatus, false));
  const offset = (page - 1) * limit;
  const notifications = await db.select().from(notificationsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit).offset(offset);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(notificationsTable)
    .where(and(...conditions));
  const [{ unread }] = await db.select({ unread: sql<number>`count(*)` }).from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.readStatus, false)));
  res.json({ data: notifications, total: Number(total), unreadCount: Number(unread), page, limit });
});

router.put("/notifications/:id/read", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [notif] = await db.update(notificationsTable).set({ readStatus: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.userId))).returning();
  if (!notif) { res.status(404).json({ error: "Not found", message: "Notification not found" }); return; }
  res.json(notif);
});

router.put("/notifications/read-all", authMiddleware, async (req, res): Promise<void> => {
  await db.update(notificationsTable).set({ readStatus: true })
    .where(eq(notificationsTable.userId, req.user!.userId));
  res.json({ success: true, message: "All notifications marked as read" });
});

router.post("/notifications/broadcast", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { title, message, targetRole, type, channel } = req.body as {
    title: string;
    message: string;
    targetRole?: string;
    type?: string;
    channel?: "in_app" | "whatsapp" | "sms" | "email";
  };
  if (!title || !message) {
    res.status(400).json({ error: "Bad request", message: "title and message are required" });
    return;
  }

  // ── Broadcast rate-limit lock (prevents duplicate sends from concurrent admins) ─
  // Atomically claim the lock: only succeeds if no broadcast was sent in the last 60 s.
  await db.execute(sql`INSERT INTO church_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  const [locked] = await db.update(churchSettingsTable)
    .set({ lastBroadcastAt: new Date() })
    .where(sql`id = 1 AND (last_broadcast_at IS NULL OR last_broadcast_at < now() - interval '60 seconds')`)
    .returning({ id: churchSettingsTable.id });
  if (!locked) {
    res.status(429).json({
      error: "Too many requests",
      message: "A broadcast was just sent. Please wait at least 60 seconds before sending another to avoid duplicate messages.",
    });
    return;
  }
  const roleFilter = targetRole ? eq(usersTable.role, targetRole as "super_admin" | "admin" | "teacher" | "support" | "parent") : undefined;
  const recipients = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.isActive, true), roleFilter));

  if (recipients.length === 0) {
    res.json({ success: true, sent: 0, message: "No recipients found" });
    return;
  }

  const notifs = recipients.map(r => ({
    userId: r.id,
    type: type || "broadcast",
    title,
    message,
    channel: channel || "in_app" as const,
    readStatus: false,
  }));

  await db.insert(notificationsTable).values(notifs);

  // Push real-time SSE events so recipients' apps update instantly
  const recipientIds = recipients.map(r => r.id);
  pushEventToUsers(recipientIds, "new_notification", { type: type || "broadcast" });

  // Also send browser push to all recipients
  pushToUsers(recipientIds, { title, body: message, icon: "/pwa-192.png", url: "/notifications" }, req.log).catch(() => {});

  // WhatsApp delivery for users who have it enabled — track results so failures are visible
  const broadcastDeliveryResults = await Promise.allSettled(recipients.map(r => dispatchExternal(r.id, title, message)));
  const broadcastDelivered = broadcastDeliveryResults.filter(r => r.status === "fulfilled" && r.value.delivered).length;
  const broadcastFailed = broadcastDeliveryResults.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.delivered)).length;
  if (broadcastFailed > 0) {
    req.log.warn({ broadcastDelivered, broadcastFailed, total: recipients.length }, "broadcast: some external deliveries failed or were skipped");
  }

  res.json({ success: true, sent: recipients.length, externalDelivered: broadcastDelivered, externalFailed: broadcastFailed, message: `Notification sent to ${recipients.length} user(s)` });
});

router.post("/notifications/pre-dismissal", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { serviceSlot, minutesBefore = 15 } = req.body as { serviceSlot?: string; minutesBefore?: number };

  // ── Pre-dismissal rate-limit lock (prevents duplicate alerts from concurrent admins) ─
  await db.execute(sql`INSERT INTO church_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  const [locked] = await db.update(churchSettingsTable)
    .set({ lastPreDismissalAt: new Date() })
    .where(sql`id = 1 AND (last_pre_dismissal_at IS NULL OR last_pre_dismissal_at < now() - interval '60 seconds')`)
    .returning({ id: churchSettingsTable.id });
  if (!locked) {
    res.status(429).json({
      error: "Too many requests",
      message: "A pre-dismissal alert was just sent. Please wait at least 60 seconds to avoid sending it twice.",
    });
    return;
  }
  const { pickupAddress, mapsLink } = await getPickupLocation();
  const title = "Pre-Dismissal Alert";
  const message = serviceSlot
    ? `Children in the ${serviceSlot} service will be dismissed in approximately ${minutesBefore} minutes. Please proceed to the collection area.\n\n📍 Pickup Location: ${pickupAddress}\n🗺️ Directions: ${mapsLink}`
    : `Children will be dismissed in approximately ${minutesBefore} minutes. Please proceed to the collection area.\n\n📍 Pickup Location: ${pickupAddress}\n🗺️ Directions: ${mapsLink}`;

  const parents = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.isActive, true), eq(usersTable.role, "parent")));

  if (parents.length === 0) {
    res.json({ success: true, sent: 0 });
    return;
  }

  const notifs = parents.map(p => ({
    userId: p.id,
    type: "pre_dismissal",
    title,
    message,
    channel: "in_app" as const,
    readStatus: false,
    metadataJson: JSON.stringify({ serviceSlot, minutesBefore, pickupAddress, mapsLink }),
  }));

  await db.insert(notificationsTable).values(notifs);

  // Push real-time SSE events to all parents instantly
  pushEventToUsers(parents.map(p => p.id), "new_notification", { type: "pre_dismissal" });

  // Browser push to all parents
  pushToRole("parent", { title, body: message, icon: "/pwa-192.png", url: "/notifications" }, req.log).catch(() => {});

  // WhatsApp delivery for parents who have it enabled — await results so failures are logged and counted
  const deliveryResults = await Promise.allSettled(parents.map(p => dispatchExternal(p.id, title, message)));
  const externalDelivered = deliveryResults.filter(r => r.status === "fulfilled" && r.value.delivered).length;
  const externalFailed = deliveryResults.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.delivered)).length;
  if (externalFailed > 0) {
    req.log.warn({ externalDelivered, externalFailed, total: parents.length, serviceSlot }, "pre-dismissal: some external deliveries failed or were skipped — manual follow-up may be needed");
  }

  res.json({
    success: true,
    sent: parents.length,
    externalDelivered,
    externalFailed,
    message: `Pre-dismissal alert sent to ${parents.length} parent(s)`,
  });
});

export default router;
