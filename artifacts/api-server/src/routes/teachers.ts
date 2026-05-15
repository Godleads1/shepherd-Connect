import { Router } from "express";
import { eq } from "drizzle-orm";
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

async function formatTeacher(t: typeof teachersTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, t.userId));
  const sanitized = user ? { id: user.id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName, isActive: user.isActive, createdAt: user.createdAt } : null;
  return { ...t, user: sanitized };
}

router.get("/teachers", authMiddleware, async (_req, res): Promise<void> => {
  const teachers = await db.select().from(teachersTable);
  const formatted = await Promise.all(teachers.map(formatTeacher));
  res.json(formatted);
});

router.post("/teachers", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateTeacherBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [teacher] = await db.insert(teachersTable).values(parsed.data).returning();
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
