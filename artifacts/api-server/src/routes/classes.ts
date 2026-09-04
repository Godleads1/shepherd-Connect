import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, classesTable, childrenTable, classWaitlistTable, familiesTable, usersTable, notificationsTable } from "@workspace/db";
import { CreateClassBody, ListClassesQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { sendNotification } from "../lib/notify";

const router = Router();

type QueryExecutor = Pick<typeof db, "select">;

async function formatClass(cls: typeof classesTable.$inferSelect, executor: QueryExecutor = db) {
  const [{ count }] = await executor.select({ count: sql<number>`count(*)` }).from(childrenTable)
    .where(eq(childrenTable.currentClassId, cls.id));
  const enrollment = Number(count);
  const [{ waitCount }] = await executor.select({ waitCount: sql<number>`count(*)` }).from(classWaitlistTable)
    .where(and(eq(classWaitlistTable.classId, cls.id), eq(classWaitlistTable.status, "waiting")));
  return { ...cls, enrollmentCount: enrollment, waitlistCount: Number(waitCount), isAtCapacity: enrollment >= cls.capacity, utilizationPercent: cls.capacity > 0 ? Math.round((enrollment / cls.capacity) * 100) : 0 };
}

// Public — class list is needed during registration for age-based auto-assignment
router.get("/classes", async (req, res): Promise<void> => {
  const params = ListClassesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { serviceSlot } = params.data;
  let classes = await db.select().from(classesTable);
  if (serviceSlot) classes = classes.filter(c => c.serviceSlot === serviceSlot);
  const formatted = await Promise.all(classes.map(cls => formatClass(cls)));
  res.json(formatted);
});

function deriveAgeFromName(name: string): number | null {
  const m = name.trim().match(/^class\s+(\d+)$/i);
  return m ? parseInt(m[1], 10) : null;
}

router.post("/classes", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateClassBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const age = deriveAgeFromName(parsed.data.name);
  const data = age !== null ? { ...parsed.data, ageMin: age, ageMax: age } : parsed.data;
  // AUTHORITATIVE: class insert. RESPONSE ENRICHMENT: enrollment/waitlist
  // counts, read before commit. Response loss can still cause a duplicate create;
  // this API has no idempotency key, so none is invented here.
  const formatted = await db.transaction(async tx => {
    const [cls] = await tx.insert(classesTable).values(data).returning();
    return formatClass(cls, tx);
  });
  res.status(201).json(formatted);
});

router.get("/classes/waitlist", authMiddleware, async (req, res): Promise<void> => {
  const { familyId: familyIdStr } = req.query as { familyId?: string };
  if (!familyIdStr) { res.status(400).json({ error: "Bad request", message: "familyId query param required" }); return; }
  const familyId = parseInt(familyIdStr, 10);
  if (isNaN(familyId)) { res.status(400).json({ error: "Bad request", message: "Invalid familyId" }); return; }
  const entries = await db.select().from(classWaitlistTable)
    .where(and(eq(classWaitlistTable.familyId, familyId), eq(classWaitlistTable.status, "waiting")))
    .orderBy(classWaitlistTable.requestedAt);
  const enriched = await Promise.all(entries.map(async (e) => {
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, e.classId));
    return { ...e, class: cls || null };
  }));
  res.json(enriched);
});

router.get("/classes/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, id));
  if (!cls) { res.status(404).json({ error: "Not found", message: "Class not found" }); return; }
  res.json(await formatClass(cls));
});

router.put("/classes/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = CreateClassBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const age = deriveAgeFromName(parsed.data.name);
  const data = age !== null ? { ...parsed.data, ageMin: age, ageMax: age } : parsed.data;
  // AUTHORITATIVE: class update. RESPONSE ENRICHMENT: enrollment/waitlist
  // counts, read before commit so formatter failure rolls back.
  const formatted = await db.transaction(async tx => {
    const [cls] = await tx.update(classesTable).set(data).where(eq(classesTable.id, id)).returning();
    return cls ? formatClass(cls, tx) : null;
  });
  if (!formatted) { res.status(404).json({ error: "Not found", message: "Class not found" }); return; }
  res.json(formatted);
});

router.delete("/classes/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  await db.delete(classesTable).where(eq(classesTable.id, id));
  res.json({ success: true, message: "Class deleted" });
});

router.get("/classes/:id/waitlist", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const entries = await db.select().from(classWaitlistTable)
    .where(and(eq(classWaitlistTable.classId, id), eq(classWaitlistTable.status, "waiting")))
    .orderBy(classWaitlistTable.requestedAt);
  const enriched = await Promise.all(entries.map(async (e) => {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, e.childId));
    const [fam] = await db.select().from(familiesTable).where(eq(familiesTable.id, e.familyId));
    return { ...e, child: child || null, family: fam || null };
  }));
  res.json(enriched);
});

router.post("/classes/:id/waitlist", authMiddleware, async (req, res): Promise<void> => {
  const classId = parseInt(req.params.id as string, 10);
  if (isNaN(classId)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { childId, familyId } = req.body as { childId: number; familyId: number };
  if (!childId || !familyId) { res.status(400).json({ error: "Bad request", message: "childId and familyId are required" }); return; }

  const [existing] = await db.select().from(classWaitlistTable)
    .where(and(eq(classWaitlistTable.classId, classId), eq(classWaitlistTable.childId, childId), eq(classWaitlistTable.status, "waiting")));
  if (existing) { res.status(409).json({ error: "Conflict", message: "Child is already on the waitlist for this class" }); return; }

  const [entry] = await db.insert(classWaitlistTable).values({ childId, classId, familyId, status: "waiting" }).returning();
  res.status(201).json(entry);
});

router.delete("/classes/:classId/waitlist/:entryId", authMiddleware, async (req, res): Promise<void> => {
  const classId = parseInt(req.params.classId as string, 10);
  const entryId = parseInt(req.params.entryId as string, 10);
  if (isNaN(classId) || isNaN(entryId)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  await db.update(classWaitlistTable).set({ status: "cancelled" })
    .where(and(eq(classWaitlistTable.id, entryId), eq(classWaitlistTable.classId, classId)));
  res.json({ success: true });
});

router.post("/classes/:id/notify-waitlist", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const classId = parseInt(req.params.id as string, 10);
  if (isNaN(classId)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classId));
  if (!cls) { res.status(404).json({ error: "Not found", message: "Class not found" }); return; }

  const waiting = await db.select().from(classWaitlistTable)
    .where(and(eq(classWaitlistTable.classId, classId), eq(classWaitlistTable.status, "waiting")))
    .orderBy(classWaitlistTable.requestedAt).limit(1);

  if (waiting.length === 0) { res.json({ success: true, notified: 0, message: "No one on the waitlist" }); return; }

  const entry = waiting[0];
  const [fam] = await db.select().from(familiesTable).where(eq(familiesTable.id, entry.familyId));
  const parentIds: number[] = [];
  if (fam?.parent1Id) parentIds.push(fam.parent1Id);
  if (fam?.parent2Id) parentIds.push(fam.parent2Id);

  if (parentIds.length > 0) {
    await Promise.all(parentIds.map(uid => sendNotification({
      userId: uid,
      type: "waitlist_space_available",
      title: `A spot opened in ${cls.name}!`,
      message: `Great news! A space is now available in ${cls.name}. Please contact the admin to confirm enrollment.`,
      metadata: { classId, className: cls.name },
    })));
  }

  await db.update(classWaitlistTable).set({ status: "notified", notifiedAt: new Date() }).where(eq(classWaitlistTable.id, entry.id));
  res.json({ success: true, notified: parentIds.length, message: `Notified ${parentIds.length} parent(s) about the available space in ${cls.name}` });
});

export default router;
