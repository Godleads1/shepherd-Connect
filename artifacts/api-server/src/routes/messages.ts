import { Router } from "express";
import { eq, or, and, desc, inArray } from "drizzle-orm";
import { db, messagesTable, usersTable, childrenTable, familiesTable, teachersTable, teacherAllocationsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { dispatchExternal } from "../lib/notify";
import { pushEvent } from "../lib/sse";
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

// Returns the users this account is allowed to message, based on role scope:
// parents ↔ teachers of their children's classes; everyone ↔ admins/support.
// Used by both the contacts dropdown AND the send endpoint so the scope
// cannot be bypassed by POSTing an arbitrary recipientId.
async function getAllowedContacts(userId: number, role: string) {
  const users = await db.select().from(usersTable)
    .where(eq(usersTable.isActive, true));

  // Admins and support can always be contacted; they can also contact anyone.
  const admins = users.filter(u => ["admin", "super_admin"].includes(u.role) && u.id !== userId);

  let scoped: typeof users = [];

  if (role === "parent") {
    // Parents only see teachers of the classes their own children are in.
    const family = await db.select().from(familiesTable)
      .where(or(eq(familiesTable.parent1Id, userId), eq(familiesTable.parent2Id, userId)))
      .limit(1);
    if (family[0]) {
      const kids = await db.select().from(childrenTable)
        .where(eq(childrenTable.familyId, family[0].id));
      const classIds = [...new Set(kids.map(k => k.currentClassId).filter((id): id is number => id != null))];
      if (classIds.length > 0) {
        // Teachers via primary class + active teacher allocations
        const allocs = await db.select().from(teacherAllocationsTable)
          .where(inArray(teacherAllocationsTable.classId, classIds));
        const teacherRows = allocs.length > 0
          ? await db.select().from(teachersTable).where(inArray(teachersTable.id, allocs.map(a => a.teacherId)))
          : [];
        const allocatedUserIds = new Set(teacherRows.map(t => t.userId));
        scoped = users.filter(u =>
          u.role === "teacher" &&
          (allocatedUserIds.has(u.id) || (u.primaryClassId != null && classIds.includes(u.primaryClassId)))
        );
      }
    }
  } else if (role === "teacher") {
    // Teachers only see parents of children in their class(es).
    const teacherRow = await db.select().from(teachersTable)
      .where(eq(teachersTable.userId, userId)).limit(1);
    const me = users.find(u => u.id === userId);
    const classIds = new Set<number>();
    if (me?.primaryClassId != null) classIds.add(me.primaryClassId);
    if (teacherRow[0]) {
      const allocs = await db.select().from(teacherAllocationsTable)
        .where(eq(teacherAllocationsTable.teacherId, teacherRow[0].id));
      for (const a of allocs) classIds.add(a.classId);
    }
    if (classIds.size > 0) {
      const kids = await db.select().from(childrenTable)
        .where(inArray(childrenTable.currentClassId, [...classIds]));
      const familyIds = [...new Set(kids.map(k => k.familyId).filter((id): id is number => id != null))];
      if (familyIds.length > 0) {
        const fams = await db.select().from(familiesTable)
          .where(inArray(familiesTable.id, familyIds));
        const parentIds = new Set(fams.flatMap(f => [f.parent1Id, f.parent2Id]).filter((id): id is number => id != null));
        scoped = users.filter(u => u.role === "parent" && parentIds.has(u.id));
      }
    }
  } else {
    // Admins / super admins can message everyone.
    scoped = users.filter(u => ["parent", "teacher"].includes(u.role));
  }

  return [...scoped, ...admins]
    .filter((u, i, arr) => u.id !== userId && arr.findIndex(x => x.id === u.id) === i);
}

router.get("/messages/contacts", authMiddleware, async (req, res): Promise<void> => {
  const allowed = await getAllowedContacts(req.user!.userId, req.user!.role);
  res.json(allowed.map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role, email: u.email, photoUrl: u.photoUrl })));
});

// Verifies the sender is entitled to reference this child in a message:
// parents must own the child; teachers must have the child in one of their
// classes; admins/super_admins may reference any child.
async function canReferenceChild(userId: number, role: string, childId: number): Promise<boolean> {
  if (["admin", "super_admin"].includes(role)) return true;
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId)).limit(1);
  if (!child) return false;
  if (role === "parent") {
    if (child.familyId == null) return false;
    const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId)).limit(1);
    return !!family && (family.parent1Id === userId || family.parent2Id === userId);
  }
  if (role === "teacher") {
    if (child.currentClassId == null) return false;
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (me?.primaryClassId === child.currentClassId) return true;
    const [teacherRow] = await db.select().from(teachersTable).where(eq(teachersTable.userId, userId)).limit(1);
    if (!teacherRow) return false;
    const allocs = await db.select().from(teacherAllocationsTable)
      .where(and(eq(teacherAllocationsTable.teacherId, teacherRow.id), eq(teacherAllocationsTable.classId, child.currentClassId)));
    return allocs.length > 0;
  }
  return false;
}

router.post("/messages", authMiddleware, async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }

  // Enforce the same contact scope as the dropdown — a parent/teacher cannot
  // bypass the UI and POST an arbitrary recipientId.
  const allowed = await getAllowedContacts(req.user!.userId, req.user!.role);
  if (!allowed.some(u => u.id === parsed.data.recipientId)) {
    res.status(403).json({ error: "Forbidden", message: "You are not allowed to message this user." });
    return;
  }
  if (parsed.data.childId != null && !(await canReferenceChild(req.user!.userId, req.user!.role, parsed.data.childId))) {
    res.status(403).json({ error: "Forbidden", message: "You are not allowed to reference this child." });
    return;
  }

  const [message] = await db.insert(messagesTable).values({
    senderId: req.user!.userId,
    recipientId: parsed.data.recipientId,
    childId: parsed.data.childId,
    subject: parsed.data.subject,
    body: parsed.data.body,
    isRead: false,
  }).returning();
  const [formatted] = await attachParticipants([message]);

  // Fire-and-forget: notify recipient via their preferred external channel (WhatsApp/SMS)
  const senderName = formatted.sender
    ? `${formatted.sender.firstName} ${formatted.sender.lastName}`
    : "Someone";
  const subject = parsed.data.subject ? `Re: ${parsed.data.subject}` : "New Message";
  dispatchExternal(
    parsed.data.recipientId,
    `${subject} from ${senderName}`,
    parsed.data.body,
  ).catch(() => {});

  // Push real-time SSE event so the recipient's app updates instantly
  pushEvent(parsed.data.recipientId, "new_message", { senderId: req.user!.userId });

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
