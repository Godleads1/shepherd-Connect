import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, teacherAllocationsTable, teachersTable, classesTable, usersTable } from "@workspace/db";
import { CreateTeacherAllocationBody, UpdateTeacherAllocationBody, ListTeacherAllocationsQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

async function formatAllocation(a: typeof teacherAllocationsTable.$inferSelect) {
  const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, a.teacherId));
  let teacherWithUser = null;
  if (teacher) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, teacher.userId));
    teacherWithUser = { ...teacher, user: user ? { id: user.id, email: user.email, phone: user.phone, role: user.role, firstName: user.firstName, lastName: user.lastName, isActive: user.isActive, createdAt: user.createdAt } : null };
  }
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, a.classId));
  return { ...a, teacher: teacherWithUser, class: cls || null };
}

router.get("/teacher-allocations", authMiddleware, async (req, res): Promise<void> => {
  const params = ListTeacherAllocationsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { serviceDate, classId, teacherId } = params.data;
  const conditions = [];
  if (serviceDate) conditions.push(eq(teacherAllocationsTable.serviceDate, serviceDate));
  if (classId) conditions.push(eq(teacherAllocationsTable.classId, classId));
  if (teacherId) conditions.push(eq(teacherAllocationsTable.teacherId, teacherId));
  const allocations = await db.select().from(teacherAllocationsTable)
    .where(conditions.length ? and(...conditions) : undefined);
  const formatted = await Promise.all(allocations.map(formatAllocation));
  res.json(formatted);
});

router.post("/teacher-allocations", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateTeacherAllocationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [allocation] = await db.insert(teacherAllocationsTable).values(parsed.data).returning();
  res.status(201).json(await formatAllocation(allocation));
});

router.put("/teacher-allocations/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = UpdateTeacherAllocationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const updates: Partial<typeof teacherAllocationsTable.$inferInsert> = {};
  if (parsed.data.status) updates.status = parsed.data.status as "scheduled" | "confirmed" | "completed" | "cancelled";
  const [allocation] = await db.update(teacherAllocationsTable).set(updates).where(eq(teacherAllocationsTable.id, id)).returning();
  if (!allocation) { res.status(404).json({ error: "Not found", message: "Allocation not found" }); return; }
  res.json(await formatAllocation(allocation));
});

export default router;
