import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, teachersTable, usersTable, classesTable } from "@workspace/db";
import { CreateTeacherBody } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { z } from "zod";

const UpdateTeacherUserBody = z.object({
  firstName:      z.string().min(1).optional(),
  lastName:       z.string().min(1).optional(),
  phone:          z.string().optional(),
  photoUrl:       z.string().optional(),
  primaryClassId: z.number().int().nullable().optional(),
});

const SelectClassBody = z.object({
  primaryClassId: z.number().int(),
});

const router = Router();

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id, email: user.email, phone: user.phone, role: user.role,
    firstName: user.firstName, lastName: user.lastName, isActive: user.isActive,
    createdAt: user.createdAt, primaryClassId: user.primaryClassId,
  };
}

async function formatTeacher(t: typeof teachersTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, t.userId));
  let primaryClass: { id: number; name: string } | null = null;
  if (user?.primaryClassId) {
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, user.primaryClassId));
    if (cls) primaryClass = { id: cls.id, name: cls.name };
  }
  return { ...t, user: user ? sanitizeUser(user) : null, primaryClass };
}

router.get("/teachers", authMiddleware, async (_req, res): Promise<void> => {
  // Auto-sync: create teacher records for ALL teacher-role users (including pending approval)
  // so they appear in allocation dropdowns even before their first login.
  const [teacherUsers, existing] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.role, "teacher")),
    db.select().from(teachersTable),
  ]);
  const existingUserIds = new Set(existing.map(t => t.userId));
  const missing = teacherUsers.filter(u => !existingUserIds.has(u.id));
  if (missing.length > 0) {
    await db.insert(teachersTable).values(missing.map(u => ({ userId: u.id })));
  }

  // Single join — no N+1
  const rows = await db
    .select()
    .from(teachersTable)
    .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id));

  // Collect unique class IDs to resolve names in one query
  const classIds = [...new Set(rows.map(r => r.users?.primaryClassId).filter(Boolean))] as number[];
  const classMap: Record<number, string> = {};
  if (classIds.length > 0) {
    const classes = await db.select().from(classesTable).where(
      classIds.length === 1
        ? eq(classesTable.id, classIds[0])
        : inArray(classesTable.id, classIds)
    );
    classes.forEach(c => { classMap[c.id] = c.name; });
  }

  const formatted = rows.map(row => ({
    ...row.teachers,
    user: row.users ? sanitizeUser(row.users) : null,
    primaryClass: row.users?.primaryClassId
      ? { id: row.users.primaryClassId, name: classMap[row.users.primaryClassId] ?? "Unknown Class" }
      : null,
  }));
  res.json(formatted);
});

router.post("/teachers", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateTeacherBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [teacher] = await db.insert(teachersTable).values(parsed.data).returning();
  // Promote the user to teacher role and activate them so they appear in all teacher
  // dropdowns (including allocations) regardless of their original registration role.
  await db.update(usersTable)
    .set({ role: "teacher", isActive: true, status: "active" })
    .where(eq(usersTable.id, parsed.data.userId));
  res.status(201).json(await formatTeacher(teacher));
});

router.get("/teachers/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, id));
  if (!teacher) { res.status(404).json({ error: "Not found", message: "Teacher not found" }); return; }
  res.json(await formatTeacher(teacher));
});

router.put("/teachers/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, id));
  if (!teacher) { res.status(404).json({ error: "Not found", message: "Teacher not found" }); return; }
  const parsed = UpdateTeacherUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { primaryClassId, ...userUpdates } = parsed.data;
  const updates: Record<string, any> = { ...userUpdates };
  if (primaryClassId !== undefined) updates.primaryClassId = primaryClassId;
  if (Object.keys(updates).length > 0) {
    await db.update(usersTable).set(updates).where(eq(usersTable.id, teacher.userId));
  }
  res.json(await formatTeacher(teacher));
});

// Teachers can self-select their primary class (only if they have none yet, or always — admin supersedes via PUT)
router.post("/teachers/me/select-class", authMiddleware, async (req, res): Promise<void> => {
  const userId = (req as any).user?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = SelectClassBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }

  // Verify the class exists
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, parsed.data.primaryClassId));
  if (!cls) { res.status(404).json({ error: "Not found", message: "Class not found" }); return; }

  await db.update(usersTable)
    .set({ primaryClassId: parsed.data.primaryClassId })
    .where(eq(usersTable.id, userId));

  res.json({ success: true, primaryClass: { id: cls.id, name: cls.name } });
});

export default router;
