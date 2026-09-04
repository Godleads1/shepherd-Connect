import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, classChangeRequestsTable, childrenTable, classesTable, usersTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { parentOwnsChild } from "../lib/parentScope";

const router = Router();

type QueryExecutor = Pick<typeof db, "select">;

async function formatRequests(
  records: typeof classChangeRequestsTable.$inferSelect[],
  includeStaffNotes = true,
  executor: QueryExecutor = db,
) {
  if (records.length === 0) return [];

  const childIds = [...new Set(records.map(r => r.childId))];
  const classIds = [...new Set([
    ...records.map(r => r.currentClassId).filter((id): id is number => id != null),
    ...records.map(r => r.requestedClassId),
  ])];
  const userIds = [...new Set(records.map(r => r.requestedBy))];

  const [children, classes, users] = await Promise.all([
    executor.select().from(childrenTable).where(inArray(childrenTable.id, childIds)),
    classIds.length > 0 ? executor.select().from(classesTable).where(inArray(classesTable.id, classIds)) : Promise.resolve([]),
    executor.select().from(usersTable).where(inArray(usersTable.id, userIds)),
  ]);

  const childMap = new Map(children.map(c => [c.id, c]));
  const classMap = new Map(classes.map(c => [c.id, c]));
  const userMap = new Map(users.map(u => [u.id, u]));

  return records.map(r => {
    const u = userMap.get(r.requestedBy);
    const formatted = {
      ...r,
      child: childMap.get(r.childId) ?? null,
      currentClass: r.currentClassId ? classMap.get(r.currentClassId) ?? null : null,
      requestedClass: classMap.get(r.requestedClassId) ?? null,
      requestedByUser: u ? { id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role } : null,
    };
    if (includeStaffNotes) return formatted;
    const { adminNotes: _adminNotes, reviewedBy: _reviewedBy, ...parentSafe } = formatted;
    return parentSafe;
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

  const formatted = await formatRequests(records, role === "super_admin" || role === "admin");
  res.json({ data: formatted, total: formatted.length });
});

router.post("/class-change-requests", authMiddleware, async (req, res): Promise<void> => {
  const { childId, requestedClassId, reason } = req.body as {
    childId: number;
    requestedClassId: number;
    currentClassId?: number;
    reason?: string;
  };

  if (!childId || !requestedClassId) {
    res.status(400).json({ error: "Bad request", message: "childId and requestedClassId are required" });
    return;
  }

  if (req.user!.role === "parent" && !(await parentOwnsChild(req.user!.userId, childId))) {
    res.status(403).json({ error: "Forbidden", message: "You can only request a class change for your own child" });
    return;
  }
  const [child] = await db.select({ currentClassId: childrenTable.currentClassId })
    .from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) {
    res.status(404).json({ error: "Not found", message: "Child not found" });
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

  // REQUIRED PRE-COMMIT VALIDATION: ownership, child, and duplicate checks.
  // AUTHORITATIVE: request insert. RESPONSE ENRICHMENT: related entities, read
  // before commit. A lost response can still cause a retry, but the existing
  // pending-request uniqueness check supplies the route's current behavior.
  const formatted = await db.transaction(async tx => {
    const [record] = await tx.insert(classChangeRequestsTable).values({
      childId,
      requestedClassId,
      currentClassId: child.currentClassId ?? null,
      reason: reason || null,
      requestedBy: req.user!.userId,
    }).returning();
    const [enriched] = await formatRequests(
      [record],
      req.user!.role === "super_admin" || req.user!.role === "admin",
      tx,
    );
    return enriched;
  });
  res.status(201).json(formatted);
});

router.put("/class-change-requests/:id/approve", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const { adminNotes } = req.body as { adminNotes?: string };

  const [request] = await db.select().from(classChangeRequestsTable).where(eq(classChangeRequestsTable.id, id));
  if (!request) { res.status(404).json({ error: "Not found", message: "Request not found" }); return; }

  // PARTIAL-MULTI-WRITE COMMAND: request approval then child reassignment.
  // RESPONSE ENRICHMENT is required pre-commit validation here; the existing
  // adjacent two-write architecture is intentionally unchanged.
  const [preformatted] = await formatRequests([request]);
  const updatedAt = new Date();
  await db.update(classChangeRequestsTable).set({
    status: "approved",
    reviewedBy: req.user!.userId,
    adminNotes: adminNotes || null,
    updatedAt,
  }).where(eq(classChangeRequestsTable.id, id));

  await db.update(childrenTable)
    .set({ currentClassId: request.requestedClassId })
    .where(eq(childrenTable.id, request.childId));

  const formatted = {
    ...preformatted,
    child: preformatted.child
      ? { ...preformatted.child, currentClassId: request.requestedClassId }
      : null,
    status: "approved" as const,
    reviewedBy: req.user!.userId,
    adminNotes: adminNotes || null,
    updatedAt,
  };
  res.json({ success: true, message: "Request approved. Child moved to new class.", request: formatted });
});

router.put("/class-change-requests/:id/reject", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const { adminNotes } = req.body as { adminNotes?: string };

  // AUTHORITATIVE: rejection mutation. RESPONSE ENRICHMENT: related entities,
  // read before commit so a required formatter failure rolls back.
  const formatted = await db.transaction(async tx => {
    const [updated] = await tx.update(classChangeRequestsTable).set({
      status: "rejected",
      reviewedBy: req.user!.userId,
      adminNotes: adminNotes || null,
      updatedAt: new Date(),
    }).where(eq(classChangeRequestsTable.id, id)).returning();
    if (!updated) return null;
    const [enriched] = await formatRequests([updated], true, tx);
    return enriched;
  });
  if (!formatted) { res.status(404).json({ error: "Not found", message: "Request not found" }); return; }
  res.json({ success: true, message: "Request rejected.", request: formatted });
});

router.delete("/class-change-requests/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [existing] = await db.select().from(classChangeRequestsTable).where(eq(classChangeRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found", message: "Request not found" }); return; }
  const isAdmin = req.user!.role === "super_admin" || req.user!.role === "admin";
  if (!isAdmin && (existing.requestedBy !== req.user!.userId || existing.status !== "pending")) {
    res.status(403).json({ error: "Forbidden", message: "You can only cancel your own pending request" });
    return;
  }
  await db.delete(classChangeRequestsTable).where(eq(classChangeRequestsTable.id, id));
  res.json({ success: true, message: "Request cancelled" });
});

export default router;
