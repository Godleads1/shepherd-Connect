import { Router } from "express";
import { eq, or, and, desc, inArray } from "drizzle-orm";
import { db, messagesTable, usersTable, childrenTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const SendMessageBody = z.object({
  recipientId: z.number(),
  childId: z.number().optional(),
  subject: z.string().optional(),
  body: z.string().min(1),
});

type RawMessage = typeof messagesTable.$inferSelect;

async function attachParticipants(messages: RawMessage[]) {
  if (messages.length === 0) return [];

  const userIds = [...new Set(messages.flatMap(m => [m.senderId, m.recipientId]))];
  const childIds = [...new Set(messages.map(m => m.childId).filter((id): id is number => id != null))];

  const [users, children] = await Promise.all([
    db.select().from(usersTable).where(inArray(usersTable.id, userIds)),
    childIds.length > 0
      ? db.select().from(childrenTable).where(inArray(childrenTable.id, childIds))
      : Promise.resolve([]),
  ]);

  const userMap = new Map(users.map(u => [u.id, u]));
  const childMap = new Map(children.map(c => [c.id, c]));

  return messages.map(m => {
    const sender = userMap.get(m.senderId);
    const recipient = userMap.get(m.recipientId);
    const child = m.childId != null ? (childMap.get(m.childId) ?? null) : null;
    return {
      ...m,
      sender: sender
        ? { id: sender.id, firstName: sender.firstName, lastName: sender.lastName, role: sender.role, photoUrl: sender.photoUrl }
        : null,
      recipient: recipient
        ? { id: recipient.id, firstName: recipient.firstName, lastName: recipient.lastName, role: recipient.role }
        : null,
      child: child ? { id: child.id, firstName: child.firstName, lastName: child.lastName } : null,
    };
  });
}

router.get("/messages", authMiddleware, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const messages = await db.select().from(messagesTable)
    .where(or(eq(messagesTable.senderId, userId), eq(messagesTable.recipientId, userId)))
    .orderBy(desc(messagesTable.createdAt));
  res.json(await attachParticipants(messages));
});

router.get("/messages/inbox", authMiddleware, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.recipientId, userId))
    .orderBy(desc(messagesTable.createdAt));
  res.json(await attachParticipants(messages));
});

router.get("/messages/sent", authMiddleware, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.senderId, userId))
    .orderBy(desc(messagesTable.createdAt));
  res.json(await attachParticipants(messages));
});

router.get("/messages/unread-count", authMiddleware, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const messages = await db.select().from(messagesTable)
    .where(and(eq(messagesTable.recipientId, userId), eq(messagesTable.isRead, false)));
  res.json({ count: messages.length });
});

router.get("/messages/contacts", authMiddleware, async (req, res): Promise<void> => {
  const role = req.user!.role;
  let targetRoles: string[] = [];
  if (role === "parent") targetRoles = ["teacher", "admin", "super_admin"];
  else if (role === "teacher") targetRoles = ["parent", "admin", "super_admin"];
  else targetRoles = ["parent", "teacher", "admin", "super_admin"];
  const users = await db.select().from(usersTable)
    .where(eq(usersTable.isActive, true));
  const contacts = users
    .filter(u => targetRoles.includes(u.role) && u.id !== req.user!.userId)
    .map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role, email: u.email, photoUrl: u.photoUrl }));
  res.json(contacts);
});

router.post("/messages", authMiddleware, async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [message] = await db.insert(messagesTable).values({
    senderId: req.user!.userId,
    recipientId: parsed.data.recipientId,
    childId: parsed.data.childId,
    subject: parsed.data.subject,
    body: parsed.data.body,
    isRead: false,
  }).returning();
  const [formatted] = await attachParticipants([message]);
  res.status(201).json(formatted);
});

router.put("/messages/:id/read", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [message] = await db.update(messagesTable).set({ isRead: true })
    .where(and(eq(messagesTable.id, id), eq(messagesTable.recipientId, req.user!.userId))).returning();
  if (!message) { res.status(404).json({ error: "Not found" }); return; }
  const [formatted] = await attachParticipants([message]);
  res.json(formatted);
});

router.delete("/messages/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!msg) { res.status(404).json({ error: "Not found" }); return; }
  if (msg.senderId !== req.user!.userId && msg.recipientId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(messagesTable).where(eq(messagesTable.id, id));
  res.json({ ok: true });
});

export default router;
