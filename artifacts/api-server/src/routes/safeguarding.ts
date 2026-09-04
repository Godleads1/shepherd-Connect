import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, safeguardingRecordsTable, usersTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const CreateRecordBody = z.object({
  teacherUserId: z.number(),
  checkType: z.string().min(1),
  referenceNumber: z.string().optional(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  status: z.enum(["clear", "pending", "expired", "not_submitted"]).default("pending"),
  notes: z.string().optional(),
});

const UpdateRecordBody = CreateRecordBody.partial().omit({ teacherUserId: true });

async function formatRecordWith(executor: any, r: typeof safeguardingRecordsTable.$inferSelect) {
  const [teacher] = await executor.select().from(usersTable).where(eq(usersTable.id, r.teacherUserId));
  return {
    ...r,
    teacher: teacher ? { id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email } : null,
    isExpiringSoon: r.expiryDate ? (() => {
      const exp = new Date(r.expiryDate);
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      return exp <= in30 && exp >= new Date();
    })() : false,
    isExpired: r.expiryDate ? new Date(r.expiryDate) < new Date() : false,
  };
}

async function formatRecord(r: typeof safeguardingRecordsTable.$inferSelect) {
  return formatRecordWith(db, r);
}

router.get("/safeguarding", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const records = await db.select().from(safeguardingRecordsTable).orderBy(desc(safeguardingRecordsTable.createdAt));
  const formatted = await Promise.all(records.map(formatRecord));
  res.json(formatted);
});

router.get("/safeguarding/expiring", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const records = await db.select().from(safeguardingRecordsTable).orderBy(desc(safeguardingRecordsTable.createdAt));
  const formatted = await Promise.all(records.map(formatRecord));
  const expiring = formatted.filter(r => r.isExpiringSoon || r.isExpired);
  res.json(expiring);
});

router.get("/safeguarding/teacher/:teacherUserId", authMiddleware, async (req, res): Promise<void> => {
  const teacherUserId = parseInt(req.params.teacherUserId as string, 10);
  if (isNaN(teacherUserId)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const role = req.user!.role;
  if (role === "teacher" && req.user!.userId !== teacherUserId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const records = await db.select().from(safeguardingRecordsTable)
    .where(eq(safeguardingRecordsTable.teacherUserId, teacherUserId))
    .orderBy(desc(safeguardingRecordsTable.createdAt));
  const formatted = await Promise.all(records.map(formatRecord));
  res.json(formatted);
});

router.post("/safeguarding", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const parsed = CreateRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const record = await db.transaction(async tx => {
    const [created] = await tx.insert(safeguardingRecordsTable).values({
      teacherUserId: parsed.data.teacherUserId,
      checkType: parsed.data.checkType,
      referenceNumber: parsed.data.referenceNumber ?? null,
      issuedDate: parsed.data.issuedDate ?? null,
      expiryDate: parsed.data.expiryDate ?? null,
      status: parsed.data.status,
      notes: parsed.data.notes ?? null,
      createdBy: req.user!.userId,
    }).returning();
    return formatRecordWith(tx, created);
  });
  res.status(201).json(record);
});

router.put("/safeguarding/:id", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = UpdateRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const record = await db.transaction(async tx => {
    const [updated] = await tx.update(safeguardingRecordsTable).set({
      ...parsed.data,
      updatedAt: new Date(),
    }).where(eq(safeguardingRecordsTable.id, id)).returning();
    return updated ? formatRecordWith(tx, updated) : null;
  });
  if (!record) { res.status(404).json({ error: "Not found", message: "Record not found" }); return; }
  res.json(record);
});

router.delete("/safeguarding/:id", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  await db.delete(safeguardingRecordsTable).where(eq(safeguardingRecordsTable.id, id));
  res.json({ ok: true });
});

export default router;
