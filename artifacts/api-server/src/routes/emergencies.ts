import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, emergenciesTable, emergencyUpdatesTable, childrenTable, usersTable, notificationsTable, attendanceTable } from "@workspace/db";
import { TriggerEmergencyBody, UpdateEmergencyBody, ListEmergenciesQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { broadcastEmergency } from "../lib/notify";

const router = Router();

async function formatEmergency(e: typeof emergenciesTable.$inferSelect) {
  let child = null;
  if (e.childId) {
    const [c] = await db.select().from(childrenTable).where(eq(childrenTable.id, e.childId));
    child = c || null;
  }
  const [triggeredByUser] = await db.select().from(usersTable).where(eq(usersTable.id, e.triggeredBy));
  return {
    ...e,
    child,
    triggeredByUser: triggeredByUser
      ? { id: triggeredByUser.id, firstName: triggeredByUser.firstName, lastName: triggeredByUser.lastName, role: triggeredByUser.role }
      : null,
  };
}

async function formatUpdate(u: typeof emergencyUpdatesTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, u.userId));
  return {
    ...u,
    user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role } : null,
  };
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

  await broadcastEmergency({
    type: emergency.type,
    level: emergency.level,
    description: emergency.description,
    emergencyId: emergency.id,
  });

  await db.insert(emergencyUpdatesTable).values({
    emergencyId: emergency.id,
    userId: req.user!.userId,
    message: `Emergency triggered: ${emergency.description}`,
    updateType: "update",
  });

  res.status(201).json(await formatEmergency(emergency));
});

router.get("/emergencies/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [emergency] = await db.select().from(emergenciesTable).where(eq(emergenciesTable.id, id));
  if (!emergency) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }
  const updates = await db.select().from(emergencyUpdatesTable)
    .where(eq(emergencyUpdatesTable.emergencyId, id))
    .orderBy(emergencyUpdatesTable.createdAt);
  const formattedUpdates = await Promise.all(updates.map(formatUpdate));
  res.json({ ...(await formatEmergency(emergency)), updates: formattedUpdates });
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

router.put("/emergencies/:id/escalate", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { newLevel, reason } = req.body as { newLevel?: string; reason?: string };
  const [emergency] = await db.select().from(emergenciesTable).where(eq(emergenciesTable.id, id));
  if (!emergency) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }

  const levelMap: Record<string, string> = { L1: "L2", L2: "L3", L3: "L4", L4: "L4" };
  const escalatedLevel = ((newLevel || levelMap[emergency.level]) as "L1" | "L2" | "L3" | "L4");

  const [updated] = await db.update(emergenciesTable)
    .set({ level: escalatedLevel, status: "active" })
    .where(eq(emergenciesTable.id, id)).returning();

  await db.insert(emergencyUpdatesTable).values({
    emergencyId: id,
    userId: req.user!.userId,
    message: reason || `Emergency escalated from ${emergency.level} to ${escalatedLevel}`,
    updateType: "escalation",
  });

  await broadcastEmergency({
    type: emergency.type,
    level: escalatedLevel,
    description: `ESCALATED to ${escalatedLevel}: ${emergency.description}`,
    emergencyId: id,
  });

  res.json(await formatEmergency(updated));
});

router.post("/emergencies/:id/update", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { message, updateType } = req.body as { message: string; updateType?: string };
  if (!message) { res.status(400).json({ error: "Bad request", message: "message is required" }); return; }
  const [emergency] = await db.select().from(emergenciesTable).where(eq(emergenciesTable.id, id));
  if (!emergency) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }
  const [update] = await db.insert(emergencyUpdatesTable).values({
    emergencyId: id,
    userId: req.user!.userId,
    message,
    updateType: (updateType as "update" | "escalation" | "all_clear" | "note") || "update",
  }).returning();
  res.status(201).json(await formatUpdate(update));
});

router.post("/emergencies/:id/all-clear", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { notes } = req.body as { notes?: string };
  const [emergency] = await db.update(emergenciesTable).set({
    status: "resolved",
    resolvedAt: new Date(),
    resolutionNotes: notes || "All clear issued by admin",
  }).where(eq(emergenciesTable.id, id)).returning();
  if (!emergency) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }

  await db.insert(emergencyUpdatesTable).values({
    emergencyId: id,
    userId: req.user!.userId,
    message: notes ? `ALL CLEAR: ${notes}` : "ALL CLEAR — Emergency has been resolved. The situation is under control.",
    updateType: "all_clear",
  });

  const allUsers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isActive, true));
  if (allUsers.length > 0) {
    await db.insert(notificationsTable).values(
      allUsers.map(u => ({
        userId: u.id,
        type: "emergency_all_clear",
        title: "✅ ALL CLEAR — Emergency Resolved",
        message: notes
          ? `The emergency has been resolved. ${notes}`
          : "The emergency situation has been fully resolved. All children are safe. Normal operations resuming.",
        channel: "in_app" as const,
        readStatus: false,
        metadataJson: JSON.stringify({ emergencyId: id }),
      }))
    );
  }

  res.json(await formatEmergency(emergency));
});

router.get("/emergencies/:id/updates", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const updates = await db.select().from(emergencyUpdatesTable)
    .where(eq(emergencyUpdatesTable.emergencyId, id))
    .orderBy(emergencyUpdatesTable.createdAt);
  const formatted = await Promise.all(updates.map(formatUpdate));
  res.json(formatted);
});

router.post("/emergencies/missing-child-search", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { childId, serviceDate } = req.body as { childId?: number; serviceDate?: string };
  const today = serviceDate || new Date().toISOString().split("T")[0];

  let childInfo = null;
  let lastKnownLocation = null;

  if (childId) {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
    childInfo = child || null;
    const attendanceRecords = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.childId, childId), eq(attendanceTable.serviceDate, today)));
    if (attendanceRecords.length > 0) {
      lastKnownLocation = attendanceRecords[attendanceRecords.length - 1];
    }
  }

  const teachers = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.isActive, true), eq(usersTable.role, "teacher")));

  if (teachers.length > 0) {
    await db.insert(notificationsTable).values(
      teachers.map(t => ({
        userId: t.id,
        type: "missing_child_search",
        title: "⚠️ MISSING CHILD — CHECK YOUR CLASS NOW",
        message: childInfo
          ? `URGENT: ${childInfo.firstName} ${childInfo.lastName} cannot be located. Please check your class and all nearby areas immediately and report to admin.`
          : "URGENT: A child cannot be located. Please check your class and all nearby areas immediately and report to admin.",
        channel: "in_app" as const,
        readStatus: false,
        metadataJson: JSON.stringify({ childId, serviceDate: today }),
      }))
    );
  }

  res.json({
    success: true,
    searchActivated: true,
    childInfo,
    lastKnownLocation,
    teachersAlerted: teachers.length,
    message: `Missing child search activated. ${teachers.length} teacher(s) alerted.`,
  });
});

export default router;
