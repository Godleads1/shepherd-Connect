import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { ListNotificationsQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { pushToUsers, pushToRole } from "../services/push";

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

  // Also send browser push to all recipients
  const recipientIds = recipients.map(r => r.id);
  pushToUsers(recipientIds, { title, body: message, icon: "/pwa-192.png", url: "/notifications" }, req.log).catch(() => {});

  res.json({ success: true, sent: recipients.length, message: `Notification sent to ${recipients.length} user(s)` });
});

router.post("/notifications/pre-dismissal", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { serviceSlot, minutesBefore = 15 } = req.body as { serviceSlot?: string; minutesBefore?: number };
  const title = "Pre-Dismissal Alert";
  const message = serviceSlot
    ? `Children in the ${serviceSlot} service will be dismissed in approximately ${minutesBefore} minutes. Please proceed to the collection area.`
    : `Children will be dismissed in approximately ${minutesBefore} minutes. Please proceed to the collection area.`;

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
    metadataJson: JSON.stringify({ serviceSlot, minutesBefore }),
  }));

  await db.insert(notificationsTable).values(notifs);

  // Browser push to all parents
  pushToRole("parent", { title, body: message, icon: "/pwa-192.png", url: "/notifications" }, req.log).catch(() => {});

  res.json({ success: true, sent: parents.length, message: `Pre-dismissal alert sent to ${parents.length} parent(s)` });
});

export default router;
