import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, classesTable, childrenTable } from "@workspace/db";
import { CreateClassBody, ListClassesQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

type QueryExecutor = Pick<typeof db, "select">;

async function formatClass(cls: typeof classesTable.$inferSelect, executor: QueryExecutor = db) {
  const [{ count }] = await executor.select({ count: sql<number>`count(*)` }).from(childrenTable)
    .where(eq(childrenTable.currentClassId, cls.id));
  const enrollment = Number(count);
  return { ...cls, enrollmentCount: enrollment, isAtCapacity: enrollment >= cls.capacity, utilizationPercent: cls.capacity > 0 ? Math.round((enrollment / cls.capacity) * 100) : 0 };
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
  // AUTHORITATIVE: class insert. RESPONSE ENRICHMENT: enrollment
  // count, read before commit. Response loss can still cause a duplicate create;
  // this API has no idempotency key, so none is invented here.
  const formatted = await db.transaction(async tx => {
    const [cls] = await tx.insert(classesTable).values(data).returning();
    return formatClass(cls, tx);
  });
  res.status(201).json(formatted);
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
  // AUTHORITATIVE: class update. RESPONSE ENRICHMENT: enrollment
  // count, read before commit so formatter failure rolls back.
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

export default router;
