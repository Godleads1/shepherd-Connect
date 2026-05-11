import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, substituteRequestsTable, usersTable, classesTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { z } from "zod/v4";

const router = Router();

const CreateSubReqBody = z.object({
  serviceDate: z.string().min(1),
  reason: z.string().min(1),
  classId: z.number().optional(),
});

const AssignSubBody = z.object({
  substituteTeacherId: z.number(),
  adminNotes: z.string().optional(),
});

async function formatReq(r: typeof substituteRequestsTable.$inferSelect) {
  const [requesting] = await db.select().from(usersTable).where(eq(usersTable.id, r.requestingTeacherId));
  let substitute = null;
  if (r.substituteTeacherId) {
    const [s] = await db.select().from(usersTable).where(eq(usersTable.id, r.substituteTeacherId));
    substitute = s ? { id: s.id, firstName: s.firstName, lastName: s.lastName, email: s.email } : null;
  }
  let cls = null;
  if (r.classId) {
    const [c] = await db.select().from(classesTable).where(eq(classesTable.id, r.classId));
    cls = c || null;
  }
  return {
    ...r,
    requestingTeacher: requesting ? { id: requesting.id, firstName: requesting.firstName, lastName: requesting.lastName, email: requesting.email } : null,
    substituteTeacher: substitute,
    class: cls,
  };
}

router.get("/substitute-requests", authMiddleware, async (req, res): Promise<void> => {
  const role = req.user!.role;
  let records: typeof substituteRequestsTable.$inferSelect[];
  if (role === "teacher") {
    records = await db.select().from(substituteRequestsTable)
      .where(eq(substituteRequestsTable.requestingTeacherId, req.user!.userId))
      .orderBy(desc(substituteRequestsTable.createdAt));
  } else {
    records = await db.select().from(substituteRequestsTable)
      .orderBy(desc(substituteRequestsTable.createdAt));
  }
  const formatted = await Promise.all(records.map(formatReq));
  res.json(formatted);
});

router.post("/substitute-requests", authMiddleware, requireRoles("teacher", "admin", "super_admin"), async (req, res): Promise<void> => {
  const parsed = CreateSubReqBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [record] = await db.insert(substituteRequestsTable).values({
    requestingTeacherId: req.user!.userId,
    serviceDate: parsed.data.serviceDate,
    reason: parsed.data.reason,
    classId: parsed.data.classId,
    status: "pending",
  }).returning();
  res.status(201).json(await formatReq(record));
});

router.put("/substitute-requests/:id/assign", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = AssignSubBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [record] = await db.update(substituteRequestsTable).set({
    substituteTeacherId: parsed.data.substituteTeacherId,
    adminNotes: parsed.data.adminNotes,
    status: "assigned",
    updatedAt: new Date(),
  }).where(eq(substituteRequestsTable.id, id)).returning();
  if (!record) { res.status(404).json({ error: "Not found", message: "Request not found" }); return; }
  res.json(await formatReq(record));
});

router.put("/substitute-requests/:id/status", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { status, adminNotes } = req.body as { status: string; adminNotes?: string };
  const validStatuses = ["pending", "assigned", "confirmed", "cancelled"];
  if (!validStatuses.includes(status)) { res.status(400).json({ error: "Bad request", message: "Invalid status" }); return; }
  const [record] = await db.update(substituteRequestsTable).set({
    status: status as "pending" | "assigned" | "confirmed" | "cancelled",
    adminNotes,
    updatedAt: new Date(),
  }).where(eq(substituteRequestsTable.id, id)).returning();
  if (!record) { res.status(404).json({ error: "Not found", message: "Request not found" }); return; }
  res.json(await formatReq(record));
});

router.delete("/substitute-requests/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [existing] = await db.select().from(substituteRequestsTable).where(eq(substituteRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found", message: "Request not found" }); return; }
  const role = req.user!.role;
  if (role === "teacher" && existing.requestingTeacherId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(substituteRequestsTable).where(eq(substituteRequestsTable.id, id));
  res.json({ ok: true });
});

export default router;
