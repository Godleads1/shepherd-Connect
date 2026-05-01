import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, childAppraisalsTable, childrenTable, teachersTable } from "@workspace/db";
import { CreateAppraisalBody, ListAppraisalsQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

async function formatAppraisal(a: typeof childAppraisalsTable.$inferSelect) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, a.childId));
  return { ...a, child: child || null };
}

router.get("/appraisals", authMiddleware, async (req, res): Promise<void> => {
  const params = ListAppraisalsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { childId, teacherId, serviceDate } = params.data;
  const conditions = [];
  if (childId) conditions.push(eq(childAppraisalsTable.childId, childId));
  if (teacherId) conditions.push(eq(childAppraisalsTable.teacherId, teacherId));
  if (serviceDate) conditions.push(eq(childAppraisalsTable.serviceDate, serviceDate));
  const appraisals = await db.select().from(childAppraisalsTable)
    .where(conditions.length ? and(...conditions) : undefined);
  const formatted = await Promise.all(appraisals.map(formatAppraisal));
  res.json(formatted);
});

router.post("/appraisals", authMiddleware, requireRoles("teacher"), async (req, res): Promise<void> => {
  const parsed = CreateAppraisalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.userId, req.user!.userId));
  if (!teacher) { res.status(403).json({ error: "Forbidden", message: "Not a registered teacher" }); return; }
  const [appraisal] = await db.insert(childAppraisalsTable).values({
    ...parsed.data,
    teacherId: teacher.id,
  }).returning();
  res.status(201).json(await formatAppraisal(appraisal));
});

export default router;
