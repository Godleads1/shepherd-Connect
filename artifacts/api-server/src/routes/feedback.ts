import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, parentFeedbackTable } from "@workspace/db";
import { SubmitFeedbackBody, ListFeedbackQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

router.get("/feedback", authMiddleware, async (req, res): Promise<void> => {
  const params = ListFeedbackQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { serviceDate, page = 1, limit = 20 } = params.data;
  const offset = (page - 1) * limit;
  const conditions = [];
  if (serviceDate) conditions.push(eq(parentFeedbackTable.serviceDate, serviceDate));
  const feedback = await db.select().from(parentFeedbackTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(limit).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(parentFeedbackTable)
    .where(conditions.length ? and(...conditions) : undefined);
  res.json({ data: feedback.map(f => ({ ...f, rating: Number(f.rating), classExperience: Number(f.classExperience), teacherEngagement: Number(f.teacherEngagement), safetyRating: Number(f.safetyRating) })), total: Number(count), page, limit });
});

router.post("/feedback", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const parsed = SubmitFeedbackBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [fb] = await db.insert(parentFeedbackTable).values({
    parentId: req.user!.userId,
    serviceDate: parsed.data.serviceDate,
    rating: String(parsed.data.rating),
    classExperience: String(parsed.data.classExperience),
    teacherEngagement: String(parsed.data.teacherEngagement),
    safetyRating: String(parsed.data.safetyRating),
    improvementNote: parsed.data.improvementNote,
  }).returning();
  res.status(201).json({ ...fb, rating: Number(fb.rating), classExperience: Number(fb.classExperience), teacherEngagement: Number(fb.teacherEngagement), safetyRating: Number(fb.safetyRating) });
});

export default router;
