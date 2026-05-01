import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { ListNotificationsQueryParams } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";

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
    .orderBy(notificationsTable.createdAt)
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

export default router;
