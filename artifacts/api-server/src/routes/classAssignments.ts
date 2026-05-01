import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, classAssignmentsTable, childrenTable, classesTable } from "@workspace/db";
import { CreateClassAssignmentBody, UpdateClassAssignmentBody, ListClassAssignmentsQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

router.get("/class-assignments", authMiddleware, async (req, res): Promise<void> => {
  const params = ListClassAssignmentsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { classId, childId, status } = params.data;
  const conditions = [];
  if (classId) conditions.push(eq(classAssignmentsTable.classId, classId));
  if (childId) conditions.push(eq(classAssignmentsTable.childId, childId));
  if (status) conditions.push(eq(classAssignmentsTable.status, status as "active" | "pending" | "inactive"));
  const assignments = await db.select().from(classAssignmentsTable)
    .where(conditions.length ? and(...conditions) : undefined);
  const withDetails = await Promise.all(assignments.map(async (a) => {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, a.childId));
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, a.classId));
    return { ...a, child: child || null, class: cls || null };
  }));
  res.json(withDetails);
});

router.post("/class-assignments", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateClassAssignmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [existing] = await db.select().from(classAssignmentsTable)
    .where(and(eq(classAssignmentsTable.childId, parsed.data.childId), eq(classAssignmentsTable.status, "active")));
  if (existing) {
    await db.update(classAssignmentsTable).set({ status: "inactive" }).where(eq(classAssignmentsTable.id, existing.id));
  }
  const [assignment] = await db.insert(classAssignmentsTable).values({
    childId: parsed.data.childId,
    classId: parsed.data.classId,
    assignedBy: req.user!.userId,
    status: "active",
  }).returning();
  await db.update(childrenTable).set({ currentClassId: parsed.data.classId }).where(eq(childrenTable.id, parsed.data.childId));
  res.status(201).json(assignment);
});

router.put("/class-assignments/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = UpdateClassAssignmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const updates: Partial<typeof classAssignmentsTable.$inferInsert> = {};
  if (parsed.data.status) updates.status = parsed.data.status as "active" | "pending" | "inactive";
  if (parsed.data.classId) updates.classId = parsed.data.classId;
  const [assignment] = await db.update(classAssignmentsTable).set(updates).where(eq(classAssignmentsTable.id, id)).returning();
  if (!assignment) { res.status(404).json({ error: "Not found", message: "Assignment not found" }); return; }
  res.json(assignment);
});

export default router;
