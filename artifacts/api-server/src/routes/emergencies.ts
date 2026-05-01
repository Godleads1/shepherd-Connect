import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, emergenciesTable, childrenTable } from "@workspace/db";
import { TriggerEmergencyBody, UpdateEmergencyBody, ListEmergenciesQueryParams } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

async function formatEmergency(e: typeof emergenciesTable.$inferSelect) {
  let child = null;
  if (e.childId) {
    const [c] = await db.select().from(childrenTable).where(eq(childrenTable.id, e.childId));
    child = c || null;
  }
  return { ...e, child };
}

router.get("/emergencies", authMiddleware, async (req, res): Promise<void> => {
  const params = ListEmergenciesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { status, level } = params.data;
  const conditions = [];
  if (status) conditions.push(eq(emergenciesTable.status, status as "active" | "monitoring" | "resolved"));
  if (level) conditions.push(eq(emergenciesTable.level, level as "L1" | "L2" | "L3" | "L4"));
  const emergencies = await db.select().from(emergenciesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(emergenciesTable.createdAt);
  const formatted = await Promise.all(emergencies.map(formatEmergency));
  res.json(formatted);
});

router.post("/emergencies", authMiddleware, async (req, res): Promise<void> => {
  const parsed = TriggerEmergencyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [emergency] = await db.insert(emergenciesTable).values({
    ...parsed.data,
    triggeredBy: req.user!.userId,
    status: "active",
  }).returning();
  res.status(201).json(await formatEmergency(emergency));
});

router.get("/emergencies/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [emergency] = await db.select().from(emergenciesTable).where(eq(emergenciesTable.id, id));
  if (!emergency) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }
  res.json(await formatEmergency(emergency));
});

router.put("/emergencies/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = UpdateEmergencyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const updates: Partial<typeof emergenciesTable.$inferInsert> = {};
  if (parsed.data.status) {
    updates.status = parsed.data.status as "active" | "monitoring" | "resolved";
    if (parsed.data.status === "resolved") updates.resolvedAt = new Date();
  }
  if (parsed.data.level) updates.level = parsed.data.level as "L1" | "L2" | "L3" | "L4";
  if (parsed.data.resolutionNotes) updates.resolutionNotes = parsed.data.resolutionNotes;
  const [emergency] = await db.update(emergenciesTable).set(updates).where(eq(emergenciesTable.id, id)).returning();
  if (!emergency) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }
  res.json(await formatEmergency(emergency));
});

export default router;
