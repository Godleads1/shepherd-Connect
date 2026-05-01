import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, classesTable, childrenTable } from "@workspace/db";
import { CreateClassBody, ListClassesQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

async function formatClass(cls: typeof classesTable.$inferSelect) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(childrenTable)
    .where(eq(childrenTable.currentClassId, cls.id));
  return { ...cls, enrollmentCount: Number(count) };
}

router.get("/classes", authMiddleware, async (req, res): Promise<void> => {
  const params = ListClassesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { serviceSlot } = params.data;
  let classes = await db.select().from(classesTable);
  if (serviceSlot) classes = classes.filter(c => c.serviceSlot === serviceSlot);
  const formatted = await Promise.all(classes.map(formatClass));
  res.json(formatted);
});

router.post("/classes", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateClassBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [cls] = await db.insert(classesTable).values(parsed.data).returning();
  res.status(201).json(await formatClass(cls));
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
  const [cls] = await db.update(classesTable).set(parsed.data).where(eq(classesTable.id, id)).returning();
  if (!cls) { res.status(404).json({ error: "Not found", message: "Class not found" }); return; }
  res.json(await formatClass(cls));
});

router.delete("/classes/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  await db.delete(classesTable).where(eq(classesTable.id, id));
  res.json({ success: true, message: "Class deleted" });
});

export default router;
