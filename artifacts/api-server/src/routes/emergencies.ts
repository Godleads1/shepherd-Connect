import { Router } from "express";
import { eq, and, like } from "drizzle-orm";
import { db, emergenciesTable, emergencyUpdatesTable, childrenTable, usersTable, notificationsTable, attendanceTable } from "@workspace/db";
import { TriggerEmergencyBody, UpdateEmergencyBody, ListEmergenciesQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { broadcastEmergency, sendNotification } from "../lib/notify";
import { createNotificationDelivery } from "../services/notificationOutbox";

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

// Emergency records are staff-facing operational data. Parents are informed
// through notifications when a broadcast targets them — they must not be able
// to read or modify the underlying incident records.
const STAFF_ROLES = ["teacher", "support", "admin", "super_admin"] as const;

router.get("/emergencies", authMiddleware, requireRoles(...STAFF_ROLES), async (req, res): Promise<void> => {
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

router.post("/emergencies", authMiddleware, requireRoles(...STAFF_ROLES), async (req, res): Promise<void> => {
  const parsed = TriggerEmergencyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  // Only admins/super_admins may alert parents. Emergencies reported by
  // teachers (or any other role) are routed to admins alone for review.
  const isAdmin = ["admin", "super_admin"].includes(req.user!.role);
  const emergency = await db.transaction(async tx => {
    const [created] = await tx.insert(emergenciesTable).values({
      ...parsed.data,
      triggeredBy: req.user!.userId,
      status: "active",
    }).returning();
    await tx.insert(emergencyUpdatesTable).values({
      emergencyId: created.id,
      userId: req.user!.userId,
      message: `Emergency triggered: ${created.description}`,
      updateType: "update",
    });
    await broadcastEmergency({
      tx,
      type: created.type,
      level: created.level,
      generation: created.level,
      description: created.description,
      emergencyId: created.id,
      childId: created.childId,
      adminsOnly: !isAdmin,
    });
    return created;
  });

  res.status(201).json(await formatEmergency(emergency));
});

router.get("/emergencies/:id", authMiddleware, requireRoles(...STAFF_ROLES), async (req, res): Promise<void> => {
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

const VALID_STATUSES = ["active", "monitoring", "resolved"] as const;
const VALID_LEVELS = ["L1", "L2", "L3", "L4"] as const;
const VALID_UPDATE_TYPES = ["update", "escalation", "all_clear", "note"] as const;

router.put("/emergencies/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = UpdateEmergencyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  if (parsed.data.status && !VALID_STATUSES.includes(parsed.data.status as any)) {
    res.status(400).json({ error: "Bad request", message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }); return;
  }
  if (parsed.data.level && !VALID_LEVELS.includes(parsed.data.level as any)) {
    res.status(400).json({ error: "Bad request", message: `Invalid level. Must be one of: ${VALID_LEVELS.join(", ")}` }); return;
  }
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

router.put("/emergencies/:id/escalate", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { newLevel, reason } = req.body as { newLevel?: string; reason?: string };
  if (newLevel && !VALID_LEVELS.includes(newLevel as any)) {
    res.status(400).json({ error: "Bad request", message: `Invalid level. Must be one of: ${VALID_LEVELS.join(", ")}` }); return;
  }
  const outcome = await db.transaction(async tx => {
    // Serialize lifecycle generations. In particular, two retries requesting
    // the same level cannot each create a broadcast/audit generation.
    const [emergency] = await tx.select().from(emergenciesTable)
      .where(eq(emergenciesTable.id, id)).for("update");
    if (!emergency) return null;
    const levelMap: Record<string, string> = { L1: "L2", L2: "L3", L3: "L4", L4: "L4" };
    const escalatedLevel = ((newLevel || levelMap[emergency.level]) as "L1" | "L2" | "L3" | "L4");
    if (escalatedLevel === emergency.level) return emergency;

    const [updated] = await tx.update(emergenciesTable)
      .set({ level: escalatedLevel, status: "active" })
      .where(eq(emergenciesTable.id, id)).returning();
    await tx.insert(emergencyUpdatesTable).values({
      emergencyId: id,
      userId: req.user!.userId,
      message: reason || `Emergency escalated from ${emergency.level} to ${escalatedLevel}`,
      updateType: "escalation",
    });
    await broadcastEmergency({
      tx,
      type: emergency.type,
      level: escalatedLevel,
      generation: escalatedLevel,
      description: `ESCALATED to ${escalatedLevel}: ${emergency.description}`,
      emergencyId: id,
      childId: emergency.childId,
    });
    return updated;
  });
  if (!outcome) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }
  res.json(await formatEmergency(outcome));
});

router.post("/emergencies/:id/update", authMiddleware, requireRoles(...STAFF_ROLES), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { message, updateType } = req.body as { message: string; updateType?: string };
  if (!message) { res.status(400).json({ error: "Bad request", message: "message is required" }); return; }
  if (updateType && !VALID_UPDATE_TYPES.includes(updateType as any)) {
    res.status(400).json({ error: "Bad request", message: `Invalid updateType. Must be one of: ${VALID_UPDATE_TYPES.join(", ")}` }); return;
  }
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
  const allClearMsg = notes
    ? `The emergency has been resolved. ${notes}`
    : "The emergency situation has been fully resolved. All children are safe. Normal operations resuming.";
  const emergency = await db.transaction(async tx => {
    const [current] = await tx.select().from(emergenciesTable)
      .where(eq(emergenciesTable.id, id)).for("update");
    if (!current) return null;
    if (current.status === "resolved") return current;
    const [resolved] = await tx.update(emergenciesTable).set({
      status: "resolved",
      resolvedAt: new Date(),
      resolutionNotes: notes || "All clear issued by admin",
    }).where(eq(emergenciesTable.id, id)).returning();
    await tx.insert(emergencyUpdatesTable).values({
      emergencyId: id,
      userId: req.user!.userId,
      message: notes ? `ALL CLEAR: ${notes}` : "ALL CLEAR — Emergency has been resolved. The situation is under control.",
      updateType: "all_clear",
    });
    // Only the original alert audience is eligible; this preserves the
    // staff-report boundary and does not leak an incident to parents.
    const alerted = await tx.select({ userId: notificationsTable.userId })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.type, "emergency_alert"),
        like(notificationsTable.metadataJson, `%"emergencyId":${id},%`),
      ));
    for (const uid of new Set(alerted.map(a => a.userId))) {
      await createNotificationDelivery(tx, {
        logicalIdentity: `emergency:${id}:all_clear:recipient:${uid}`,
        domainType: "emergency",
        domainIdentifier: `${id}:all_clear`,
        projection: {
          userId: uid,
          type: "emergency_all_clear",
          title: "✅ ALL CLEAR — Emergency Resolved",
          message: allClearMsg,
          metadata: { emergencyId: id },
        },
        channels: ["whatsapp"],
        templateKey: "emergency_all_clear",
        templateMetadata: { emergencyId: id },
      });
    }
    return resolved;
  });
  if (!emergency) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }

  res.json(await formatEmergency(emergency));
});

router.get("/emergencies/:id/updates", authMiddleware, requireRoles(...STAFF_ROLES), async (req, res): Promise<void> => {
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

  const missingMsg = childInfo
    ? `URGENT: ${childInfo.firstName} ${childInfo.lastName} cannot be located. Please check your class and all nearby areas immediately and report to admin.`
    : "URGENT: A child cannot be located. Please check your class and all nearby areas immediately and report to admin.";
  await Promise.all(teachers.map(t => sendNotification({
    userId: t.id,
    type: "missing_child_search",
    title: "⚠️ MISSING CHILD — CHECK YOUR CLASS NOW",
    message: missingMsg,
    metadata: { childId, serviceDate: today },
  })));

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
