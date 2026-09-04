import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, childAppraisalsTable, childrenTable, teachersTable, familiesTable, usersTable } from "@workspace/db";
import { CreateAppraisalBody, ListAppraisalsQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { emailShepherdsReport } from "../services/sms";
import { pushToUsers } from "../services/push";
import { getParentChildIds } from "../lib/parentScope";

const router = Router();

async function formatAppraisalWith(executor: any, a: typeof childAppraisalsTable.$inferSelect) {
  const [child] = await executor.select().from(childrenTable).where(eq(childrenTable.id, a.childId));
  return { ...a, child: child || null };
}

async function formatAppraisal(a: typeof childAppraisalsTable.$inferSelect) {
  return formatAppraisalWith(db, a);
}

router.get("/appraisals", authMiddleware, async (req, res): Promise<void> => {
  const params = ListAppraisalsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { childId, teacherId, serviceDate } = params.data;
  const conditions = [];
  // Parents may only see appraisals for their own children.
  if (req.user!.role === "parent") {
    const ownChildIds = await getParentChildIds(req.user!.userId);
    if (ownChildIds.length === 0) { res.json([]); return; }
    if (childId !== undefined) {
      if (!ownChildIds.includes(childId)) {
        res.status(403).json({ error: "Forbidden", message: "Access denied" }); return;
      }
    } else {
      conditions.push(inArray(childAppraisalsTable.childId, ownChildIds));
    }
  }
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
  const appraisal = await db.transaction(async tx => {
    const [created] = await tx.insert(childAppraisalsTable).values({
      ...parsed.data,
      teacherId: teacher.id,
    }).returning();
    return formatAppraisalWith(tx, created);
  });

  // Send Shepherd's Report email to parents (fire-and-forget)
  void Promise.resolve()
    .then(() => Promise.all([
      db.select().from(childrenTable).where(eq(childrenTable.id, appraisal.childId)),
      db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)),
    ]))
    .then(async ([[child], [teacherUser]]) => {
      if (!child) return;
      const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
      if (!family) return;
      const parentIds = [family.parent1Id, family.parent2Id].filter(Boolean) as number[];
      const parents = await Promise.all(
        parentIds.map(id => db.select({ email: usersTable.email, firstName: usersTable.firstName }).from(usersTable).where(eq(usersTable.id, id)))
      );
      const parentRows = parents.flat();
      const childName = `${child.firstName} ${child.lastName}`;
      const teacherName = teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : "Your child's teacher";
      const parentFirstName = parentRows[0]?.firstName ?? "Parent";
      const emails = parentRows.map(p => p.email);
      await emailShepherdsReport(
        emails, parentFirstName, childName, teacherName,
        appraisal.participationLevel, appraisal.scriptureEngagement, appraisal.socialInteraction,
        appraisal.milestoneNote, appraisal.personalNoteToParent, appraisal.serviceDate, req.log,
      );
      await pushToUsers(parentIds, {
        title: "📋 Shepherd's Report Ready",
        body: `${teacherName} has submitted a report for ${childName}. Tap to view.`,
        icon: "/pwa-192.png",
        url: "/my-children",
      }, req.log);
    })
    .catch((err) => {
      req.log.warn({ err, appraisalId: appraisal.id }, "appraisal: optional parent notifications failed");
    });

  res.status(201).json(appraisal);
});

export default router;
