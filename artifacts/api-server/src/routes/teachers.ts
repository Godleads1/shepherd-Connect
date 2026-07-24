import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, teachersTable, usersTable } from "@workspace/db";
import { CreateTeacherBody } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { z } from "zod";

const UpdateTeacherUserBody = z.object({
  firstName: z.string().min(1).optional(),
  lastName:  z.string().min(1).optional(),
  phone:     z.string().optional(),
  photoUrl:  z.string().optional(),
});

const router = Router();

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  return { id: user.id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName, isActive: user.isActive, createdAt: user.createdAt };
}

async function formatTeacher(t: typeof teachersTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, t.userId));
  return { ...t, user: user ? sanitizeUser(user) : null };
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

  const formatted = rows.map(row => ({
    ...row.teachers,
    user: row.users ? sanitizeUser(row.users) : null,
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
  const updates = parsed.data;
  if (Object.keys(updates).length > 0) {
    await db.update(usersTable).set(updates).where(eq(usersTable.id, teacher.userId));
  }
  res.json(await formatTeacher(teacher));
});

export default router;
