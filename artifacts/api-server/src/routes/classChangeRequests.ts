import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, classChangeRequestsTable, childrenTable, classesTable, usersTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

async function formatRequests(records: typeof classChangeRequestsTable.$inferSelect[]) {
  if (records.length === 0) return [];

  const childIds = [...new Set(records.map(r => r.childId))];
  const classIds = [...new Set([
    ...records.map(r => r.currentClassId).filter((id): id is number => id != null),
    ...records.map(r => r.requestedClassId),
  ])];
  const userIds = [...new Set(records.map(r => r.requestedBy))];

  const [children, classes, users] = await Promise.all([
    db.select().from(childrenTable).where(inArray(childrenTable.id, childIds)),
    classIds.length > 0 ? db.select().from(classesTable).where(inArray(classesTable.id, classIds)) : Promise.resolve([]),
    db.select().from(usersTable).where(inArray(usersTable.id, userIds)),
  ]);

  const childMap = new Map(children.map(c => [c.id, c]));
  const classMap = new Map(classes.map(c => [c.id, c]));
  const userMap = new Map(users.map(u => [u.id, u]));

  return records.map(r => {
    const u = userMap.get(r.requestedBy);
    return {
      ...r,
      child: childMap.get(r.childId) ?? null,
      currentClass: r.currentClassId ? classMap.get(r.currentClassId) ?? null : null,
      requestedClass: classMap.get(r.requestedClassId) ?? null,
      requestedByUser: u ? { id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role } : null,
    };
  });
}

router.get("/class-change-requests", authMiddleware, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const statusFilter = req.query["status"] as string | undefined;

  let records: typeof classChangeRequestsTable.$inferSelect[];
  if (role === "super_admin" || role === "admin") {
    const conditions = [];
    if (statusFilter) conditions.push(eq(classChangeRequestsTable.status, statusFilter as "pending" | "approved" | "rejected"));
    records = await db.select().from(classChangeRequestsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(classChangeRequestsTable.createdAt);
  } else {
    const conditions = [eq(classChangeRequestsTable.requestedBy, userId)];
    if (statusFilter) conditions.push(eq(classChangeRequestsTable.status, statusFilter as "pending" | "approved" | "rejected"));
    records = await db.select().from(classChangeRequestsTable)
      .where(and(...conditions))
      .orderBy(classChangeRequestsTable.createdAt);
  }

  const formatted = await formatRequests(records);
  res.json({ data: formatted, total: formatted.length });
});

router.post("/class-change-requests", authMiddleware, async (req, res): Promise<void> => {
  const { childId, requestedClassId, currentClassId, reason } = req.body as {
    childId: number;
    requestedClassId: number;
    currentClassId?: number;
    reason?: string;
  };

  if (!childId || !requestedClassId) {
    res.status(400).json({ error: "Bad request", message: "childId and requestedClassId are required" });
    return;
  }

  const [existing] = await db.select().from(classChangeRequestsTable)
    .where(and(
      eq(classChangeRequestsTable.childId, childId),
      eq(classChangeRequestsTable.requestedClassId, requestedClassId),
      eq(classChangeRequestsTable.status, "pending"),
    ));
  if (existing) {
    res.status(409).json({ error: "Conflict", message: "A pending request for this class already exists" });
    return;
  }

  const [record] = await db.insert(classChangeRequestsTable).values({
    childId,
    requestedClassId,
    currentClassId: currentClassId || null,
    reason: reason || null,
    requestedBy: req.user!.userId,
  }).returning();

  const formatted = await formatRequest(record);
  res.status(201).json(formatted);
});

router.put("/class-change-requests/:id/approve", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const { adminNotes } = req.body as { adminNotes?: string };

  const [request] = await db.select().from(classChangeRequestsTable).where(eq(classChangeRequestsTable.id, id));
  if (!request) { res.status(404).json({ error: "Not found", message: "Request not found" }); return; }

  await db.update(classChangeRequestsTable).set({
    status: "approved",
    reviewedBy: req.user!.userId,
    adminNotes: adminNotes || null,
    updatedAt: new Date(),
  }).where(eq(classChangeRequestsTable.id, id));

  await db.update(childrenTable)
    .set({ currentClassId: request.requestedClassId })
    .where(eq(childrenTable.id, request.childId));

  const [updated] = await db.select().from(classChangeRequestsTable).where(eq(classChangeRequestsTable.id, id));
  const formatted = await formatRequest(updated);
  res.json({ success: true, message: "Request approved. Child moved to new class.", request: formatted });
});

router.put("/class-change-requests/:id/reject", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const { adminNotes } = req.body as { adminNotes?: string };

  const [updated] = await db.update(classChangeRequestsTable).set({
    status: "rejected",
    reviewedBy: req.user!.userId,
    adminNotes: adminNotes || null,
    updatedAt: new Date(),
  }).where(eq(classChangeRequestsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found", message: "Request not found" }); return; }

  const formatted = await formatRequest(updated);
  res.json({ success: true, message: "Request rejected.", request: formatted });
});

router.delete("/class-change-requests/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  await db.delete(classChangeRequestsTable).where(eq(classChangeRequestsTable.id, id));
  res.json({ success: true, message: "Request cancelled" });
});

export default router;
