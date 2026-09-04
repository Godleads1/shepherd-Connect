import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, parentFeedbackTable } from "@workspace/db";
import { SubmitFeedbackBody, ListFeedbackQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { scoreFeedbackRecord, scoreAllUnscoredFeedback } from "../services/sentiment";

const router = Router();

function serializeFeedback(f: typeof parentFeedbackTable.$inferSelect) {
  return {
    ...f,
    rating: Number(f.rating),
    classExperience: Number(f.classExperience),
    teacherEngagement: Number(f.teacherEngagement),
    safetyRating: Number(f.safetyRating),
    sentimentScore: f.sentimentScore != null ? Number(f.sentimentScore) : null,
  };
}

function serializeParentFeedback(f: typeof parentFeedbackTable.$inferSelect) {
  const { sentimentScore: _sentimentScore, sentimentLabel: _sentimentLabel, sentimentNote: _sentimentNote, ...safe } = serializeFeedback(f);
  return safe;
}

router.get("/feedback", authMiddleware, async (req, res): Promise<void> => {
  const params = ListFeedbackQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { serviceDate, page = 1, limit = 20 } = params.data;
  const offset = (page - 1) * limit;
  const conditions = [];
  const isAdmin = req.user!.role === "super_admin" || req.user!.role === "admin";
  if (!isAdmin && req.user!.role !== "parent") {
    res.status(403).json({ error: "Forbidden", message: "Feedback is only available to parents and administrators" });
    return;
  }
  if (req.user!.role === "parent") conditions.push(eq(parentFeedbackTable.parentId, req.user!.userId));
  if (serviceDate) conditions.push(eq(parentFeedbackTable.serviceDate, serviceDate));
  const feedback = await db.select().from(parentFeedbackTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(parentFeedbackTable.createdAt)
    .limit(limit).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(parentFeedbackTable)
    .where(conditions.length ? and(...conditions) : undefined);
  res.json({ data: feedback.map(isAdmin ? serializeFeedback : serializeParentFeedback), total: Number(count), page, limit });
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
  res.status(201).json(serializeFeedback(fb));

  // Async sentiment analysis — does not block the response
  void scoreFeedbackRecord(fb.id);
});

router.post("/feedback/analyze-all", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const result = await scoreAllUnscoredFeedback();
  res.json(result);
});

export default router;
