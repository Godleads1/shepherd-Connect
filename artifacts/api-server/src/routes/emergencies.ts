import { Router, type Request, type Response } from "express";
import { eq, and, like, inArray, isNotNull, desc, sql } from "drizzle-orm";
import { db, emergenciesTable, emergencyUpdatesTable, childrenTable, usersTable, notificationsTable, attendanceTable, familiesTable } from "@workspace/db";
import {
  TriggerEmergencyBody,
  UpdateEmergencyBody,
  ListEmergenciesQueryParams,
  PublishFamilyEmergencyUpdateBody,
  PostEmergencyTimelineUpdateBody,
  ListFamilyEmergencyUpdatesResponseItem,
  ListFamilyEmergencyUpdatesResponse,
} from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { broadcastEmergency, sendNotification } from "../lib/notify";
import { createNotificationDelivery } from "../services/notificationOutbox";
import { getParentChildIds } from "../lib/parentScope";
import { scopeFamilyEmergencyUpdates, toFamilyEmergencyUpdateDto } from "../lib/familyEmergencyUpdates";
import {
  classifyCommandOperation,
  findCommandOperation,
  fingerprintCommandPayload,
  lockCommandOperation,
  persistCommandOperation,
  replayCommandResult,
} from "../services/commandOperations";

const router = Router();

const EMERGENCY_TIMELINE_UPDATE_COMMAND = "emergency_timeline_update";
const EMERGENCY_TARGET_TYPE = "emergency";
const EMERGENCY_CREATE_COMMAND = "emergency_create";
const EMERGENCY_CREATE_TARGET_TYPE = "emergency_create";

export const emergencyUpdateRouteDependencies: {
  beforePersist: null | (() => void | Promise<void>);
  postCommitBeforeResponse: null | ((req: Request, res: Response) => void);
} = {
  beforePersist: null,
  // Tests may terminate the real HTTP socket here, after the transaction has
  // committed and before Express writes a response.
  postCommitBeforeResponse: null,
};

export const emergencyCreateRouteDependencies: {
  /** Test-only seam immediately after required transactional broadcast intent. */
  requiredOutboxFailure: null | (() => void | Promise<void>);
  beforePersist: null | (() => void | Promise<void>);
  postCommitBeforeResponse: null | ((req: Request, res: Response) => void);
} = {
  requiredOutboxFailure: null,
  beforePersist: null,
  // Tests may terminate the real HTTP socket here, after the transaction has
  // committed and before Express writes a response.
  postCommitBeforeResponse: null,
};

type QueryExecutor = Pick<typeof db, "select">;

async function formatEmergency(e: typeof emergenciesTable.$inferSelect, executor: QueryExecutor = db) {
  let child = null;
  if (e.childId) {
    const [c] = await executor.select().from(childrenTable).where(eq(childrenTable.id, e.childId));
    child = c || null;
  }
  const [triggeredByUser] = await executor.select().from(usersTable).where(eq(usersTable.id, e.triggeredBy));
  return {
    ...e,
    child,
    triggeredByUser: triggeredByUser
      ? { id: triggeredByUser.id, firstName: triggeredByUser.firstName, lastName: triggeredByUser.lastName, role: triggeredByUser.role }
      : null,
  };
}

async function formatUpdate(u: typeof emergencyUpdatesTable.$inferSelect, executor: QueryExecutor = db) {
  const [user] = await executor.select().from(usersTable).where(eq(usersTable.id, u.userId));
  return {
    ...u,
    user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role } : null,
  };
}

async function isCurrentlyAuthorizedStaff(executor: any, userId: number, role: string): Promise<boolean> {
  const [user] = await executor.select({
    role: usersTable.role,
    secondaryRoles: usersTable.secondaryRoles,
    status: usersTable.status,
    isActive: usersTable.isActive,
  }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !user.isActive || user.status !== "active") return false;
  let secondaryRoles: string[] = [];
  try {
    const parsed = JSON.parse(user.secondaryRoles || "[]");
    if (Array.isArray(parsed)) secondaryRoles = parsed.filter((value): value is string => typeof value === "string");
  } catch {
    secondaryRoles = [];
  }
  return [...STAFF_ROLES].includes(role as any) && (user.role === role || secondaryRoles.includes(role));
}

// Emergency records are staff-facing operational data. Parents are informed
// through notifications when a broadcast targets them — they must not be able
// to read or modify the underlying incident records.
const STAFF_ROLES = ["teacher", "support", "admin", "super_admin"] as const;

router.get("/family/emergency-updates", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const childIds = await getParentChildIds(req.user!.userId);
  if (childIds.length === 0) {
    res.json([]);
    return;
  }
  const rows = await db.select({
    id: emergencyUpdatesTable.id,
    emergencyId: emergencyUpdatesTable.emergencyId,
    childId: childrenTable.id,
    childFirstName: childrenTable.firstName,
    familyStatus: emergencyUpdatesTable.familyStatus,
    familyInstructions: emergencyUpdatesTable.familyInstructions,
    publishedAt: emergencyUpdatesTable.publishedAt,
  })
    .from(emergencyUpdatesTable)
    .innerJoin(emergenciesTable, eq(emergenciesTable.id, emergencyUpdatesTable.emergencyId))
    .innerJoin(childrenTable, eq(childrenTable.id, emergenciesTable.childId))
    .innerJoin(familiesTable, eq(familiesTable.id, childrenTable.familyId))
    .where(and(
      inArray(childrenTable.id, childIds),
      isNotNull(emergencyUpdatesTable.publishedAt),
      isNotNull(emergencyUpdatesTable.familyStatus),
      isNotNull(emergencyUpdatesTable.familyInstructions),
    ))
    .orderBy(desc(emergencyUpdatesTable.publishedAt));
  res.json(ListFamilyEmergencyUpdatesResponse.parse(scopeFamilyEmergencyUpdates(rows.map(row => ({
    ...row,
    familyStatus: row.familyStatus!,
    familyInstructions: row.familyInstructions!,
    publishedAt: row.publishedAt!,
  })), childIds)));
});

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
  const formatted = await Promise.all(emergencies.map(emergency => formatEmergency(emergency)));
  res.json(formatted);
});

router.post("/emergencies", authMiddleware, requireRoles(...STAFF_ROLES), async (req, res): Promise<void> => {
  const parsed = TriggerEmergencyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  // Only admins/super_admins may alert parents. Emergencies reported by
  // teachers (or any other role) are routed to admins alone for review.
  const isAdmin = ["admin", "super_admin"].includes(req.user!.role);
  const input = {
    type: parsed.data.type,
    level: parsed.data.level,
    childId: parsed.data.childId ?? null,
    description: parsed.data.description,
  };
  // The audience boundary is command input too: staff-originated incidents
  // intentionally notify admins only, while admins may notify parents.
  const binding = {
    actorUserId: req.user!.userId,
    command: EMERGENCY_CREATE_COMMAND,
    targetType: EMERGENCY_CREATE_TARGET_TYPE,
    targetId: `child:${input.childId ?? "none"}`,
    payloadFingerprint: fingerprintCommandPayload({ ...input, adminsOnly: !isAdmin }),
  };
  const result = await db.transaction(async tx => {
    // Always take the command-operation lock before any authorization read,
    // domain write, or notification/outbox lock.
    await lockCommandOperation(tx, parsed.data.operationId);
    if (!await isCurrentlyAuthorizedStaff(tx, req.user!.userId, req.user!.role)) {
      return { kind: "unauthorized" as const };
    }
    const existing = await findCommandOperation(tx, parsed.data.operationId);
    const classification = classifyCommandOperation(existing, binding);
    if (classification === "collision") return { kind: "collision" as const };
    if (classification === "replay") {
      const { primaryId } = replayCommandResult(existing!);
      const [emergency] = await tx.select().from(emergenciesTable)
        .where(eq(emergenciesTable.id, primaryId));
      if (!emergency) throw new Error("Completed emergency result is missing");
      return { kind: "complete" as const, replayed: true, emergency: await formatEmergency(emergency, tx) };
    }
    // AUTHORITATIVE: emergency + initial audit update. REQUIRED
    // TRANSACTIONAL OUTBOX/INTENT: broadcast intent. Response enrichment also
    // runs in this transaction, so any required failure rolls back all effects.
    const [created] = await tx.insert(emergenciesTable).values({
      ...input,
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
    // The broadcast's notification projections/outbox rows are required
    // transaction effects. A failure at this boundary must abort the entire
    // command, rather than reporting an emergency with unresolved intent.
    await emergencyCreateRouteDependencies.requiredOutboxFailure?.();
    await emergencyCreateRouteDependencies.beforePersist?.();
    await persistCommandOperation(tx, {
      operationId: parsed.data.operationId,
      ...binding,
      primaryId: created.id,
      resultVersion: 1,
    });
    return { kind: "complete" as const, replayed: false, emergency: await formatEmergency(created, tx) };
  });
  if (result.kind === "unauthorized") { res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" }); return; }
  if (result.kind === "collision") { res.status(409).json({ error: "Conflict", message: "operationId is bound to different command input" }); return; }
  emergencyCreateRouteDependencies.postCommitBeforeResponse?.(req, res);
  if (res.destroyed || res.socket?.destroyed) return;
  res.status(result.replayed ? 200 : 201).json({
    ...result.emergency,
    operationId: parsed.data.operationId,
    outcome: result.replayed ? "already_applied" : "applied",
  });
});

router.get("/emergencies/operations/:operationId", authMiddleware, requireRoles(...STAFF_ROLES), async (req, res): Promise<void> => {
  const operationId = req.params.operationId as string;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
    res.status(400).json({ error: "Bad request", message: "Invalid operation identity" });
    return;
  }
  const emergency = await db.transaction(async tx => {
    await lockCommandOperation(tx, operationId);
    if (!await isCurrentlyAuthorizedStaff(tx, req.user!.userId, req.user!.role)) return null;
    const operation = await findCommandOperation(tx, operationId);
    if (!operation
      || operation.actorUserId !== req.user!.userId
      || operation.command !== EMERGENCY_CREATE_COMMAND
      || operation.targetType !== EMERGENCY_CREATE_TARGET_TYPE) return null;
    const { primaryId } = replayCommandResult(operation);
    const [created] = await tx.select().from(emergenciesTable).where(eq(emergenciesTable.id, primaryId));
    return created ? formatEmergency(created, tx) : null;
  });
  // Do not reveal another actor's operation existence.
  if (!emergency) { res.status(404).json({ error: "Not found", message: "Operation not found" }); return; }
  res.json({ ...emergency, operationId, outcome: "already_applied" });
});

router.get("/emergencies/:id", authMiddleware, requireRoles(...STAFF_ROLES), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [emergency] = await db.select().from(emergenciesTable).where(eq(emergenciesTable.id, id));
  if (!emergency) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }
  const updates = await db.select().from(emergencyUpdatesTable)
    .where(eq(emergencyUpdatesTable.emergencyId, id))
    .orderBy(emergencyUpdatesTable.createdAt);
  const formattedUpdates = await Promise.all(updates.map(update => formatUpdate(update)));
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
  // AUTHORITATIVE: emergency mutation. RESPONSE ENRICHMENT: child/triggering user;
  // required response reads run in the same transaction so failure rolls back.
  const formatted = await db.transaction(async tx => {
    const [emergency] = await tx.update(emergenciesTable).set(updates).where(eq(emergenciesTable.id, id)).returning();
    return emergency ? formatEmergency(emergency, tx) : null;
  });
  if (!formatted) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }
  res.json(formatted);
});

router.put("/emergencies/:id/escalate", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { newLevel, reason } = req.body as { newLevel?: string; reason?: string };
  if (newLevel && !VALID_LEVELS.includes(newLevel as any)) {
    res.status(400).json({ error: "Bad request", message: `Invalid level. Must be one of: ${VALID_LEVELS.join(", ")}` }); return;
  }
  // AUTHORITATIVE: lifecycle mutation + audit update. REQUIRED TRANSACTIONAL
  // OUTBOX/INTENT: escalation broadcast. RESPONSE ENRICHMENT runs before commit.
  const outcome = await db.transaction(async tx => {
    // Serialize lifecycle generations. In particular, two retries requesting
    // the same level cannot each create a broadcast/audit generation.
    const [emergency] = await tx.select().from(emergenciesTable)
      .where(eq(emergenciesTable.id, id)).for("update");
    if (!emergency) return null;
    const levelMap: Record<string, string> = { L1: "L2", L2: "L3", L3: "L4", L4: "L4" };
    const escalatedLevel = ((newLevel || levelMap[emergency.level]) as "L1" | "L2" | "L3" | "L4");
    if (escalatedLevel === emergency.level) return formatEmergency(emergency, tx);

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
    return formatEmergency(updated, tx);
  });
  if (!outcome) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }
  res.json(outcome);
});

router.post("/emergencies/:id/update", authMiddleware, requireRoles(...STAFF_ROLES), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = PostEmergencyTimelineUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const message = parsed.data.message.trim();
  if (!message) { res.status(400).json({ error: "Bad request", message: "message cannot be blank" }); return; }
  const updateType = parsed.data.updateType ?? "update";
  const binding = {
    actorUserId: req.user!.userId,
    command: EMERGENCY_TIMELINE_UPDATE_COMMAND,
    targetType: EMERGENCY_TARGET_TYPE,
    targetId: String(id),
    payloadFingerprint: fingerprintCommandPayload({ message, updateType }),
  };
  const result = await db.transaction(async tx => {
    // The operation lock is always first; no emergency/domain row is read or
    // locked before concurrent submissions sharing this operation ID serialize.
    await lockCommandOperation(tx, parsed.data.operationId);
    if (!await isCurrentlyAuthorizedStaff(tx, req.user!.userId, req.user!.role)) {
      return { kind: "unauthorized" as const };
    }
    const existing = await findCommandOperation(tx, parsed.data.operationId);
    const classification = classifyCommandOperation(existing, binding);
    if (classification === "collision") return { kind: "collision" as const };
    if (classification === "replay") {
      const { primaryId } = replayCommandResult(existing!);
      const [update] = await tx.select().from(emergencyUpdatesTable).where(and(
        eq(emergencyUpdatesTable.id, primaryId),
        eq(emergencyUpdatesTable.emergencyId, id),
      ));
      if (!update) throw new Error("Completed emergency update result is missing");
      return { kind: "complete" as const, replayed: true, update: await formatUpdate(update, tx) };
    }
    const [emergency] = await tx.select().from(emergenciesTable).where(eq(emergenciesTable.id, id));
    if (!emergency) return { kind: "missing" as const };
    const [update] = await tx.insert(emergencyUpdatesTable).values({
      emergencyId: id,
      userId: req.user!.userId,
      message,
      updateType,
      eventId: parsed.data.operationId,
    }).returning();
    await emergencyUpdateRouteDependencies.beforePersist?.();
    await persistCommandOperation(tx, {
      operationId: parsed.data.operationId,
      ...binding,
      primaryId: update.id,
      resultVersion: 1,
    });
    return { kind: "complete" as const, replayed: false, update: await formatUpdate(update, tx) };
  });
  if (result.kind === "unauthorized") { res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" }); return; }
  if (result.kind === "collision") { res.status(409).json({ error: "Conflict", message: "operationId is bound to different command input" }); return; }
  if (result.kind === "missing") { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }
  emergencyUpdateRouteDependencies.postCommitBeforeResponse?.(req, res);
  if (res.destroyed || res.socket?.destroyed) return;
  res.status(result.replayed ? 200 : 201).json({
    ...result.update,
    operationId: parsed.data.operationId,
    outcome: result.replayed ? "already_applied" : "applied",
  });
});

router.get("/emergencies/:id/update-operations/:operationId", authMiddleware, requireRoles(...STAFF_ROLES), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const operationId = req.params.operationId as string;
  if (isNaN(id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
    res.status(400).json({ error: "Bad request", message: "Invalid operation identity" });
    return;
  }
  const result = await db.transaction(async tx => {
    await lockCommandOperation(tx, operationId);
    if (!await isCurrentlyAuthorizedStaff(tx, req.user!.userId, req.user!.role)) return null;
    const operation = await findCommandOperation(tx, operationId);
    if (!operation
      || operation.actorUserId !== req.user!.userId
      || operation.command !== EMERGENCY_TIMELINE_UPDATE_COMMAND
      || operation.targetType !== EMERGENCY_TARGET_TYPE
      || operation.targetId !== String(id)) return null;
    const { primaryId } = replayCommandResult(operation);
    const [emergency] = await tx.select({ id: emergenciesTable.id }).from(emergenciesTable)
      .where(eq(emergenciesTable.id, id));
    if (!emergency) return null;
    const [update] = await tx.select().from(emergencyUpdatesTable).where(and(
      eq(emergencyUpdatesTable.id, primaryId),
      eq(emergencyUpdatesTable.emergencyId, id),
    ));
    return update ? formatUpdate(update, tx) : null;
  });
  if (!result) { res.status(404).json({ error: "Not found", message: "Operation not found" }); return; }
  res.json({ ...result, operationId, outcome: "already_applied" });
});

router.post("/emergencies/:id/family-update", authMiddleware, requireRoles("support", "admin", "super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Bad request", message: "Invalid ID" });
    return;
  }
  const parsed = PublishFamilyEmergencyUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const familyStatus = parsed.data.status.trim();
  const familyInstructions = parsed.data.instructions.trim();
  const eventId = parsed.data.eventId.trim();
  if (!familyStatus || !familyInstructions || !eventId) {
    res.status(400).json({ error: "Bad request", message: "Status, instructions, and eventId cannot be blank" });
    return;
  }
  const result = await db.transaction(async tx => {
    // This lock covers the row, idempotency lookup, notification projection,
    // and outbox inserts as one retry-safe publication operation.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`emergency:${id}:family-update:${eventId}`}))`);
    const [emergency] = await tx.select({
      id: emergenciesTable.id,
      childId: emergenciesTable.childId,
      status: emergenciesTable.status,
    }).from(emergenciesTable).where(eq(emergenciesTable.id, id)).for("update");
    if (!emergency) return { kind: "missing" as const };
    if (emergency.status === "resolved") return { kind: "closed" as const };
    if (emergency.childId == null) return { kind: "unlinked" as const };

    const [child] = await tx.select({ id: childrenTable.id, firstName: childrenTable.firstName, familyId: childrenTable.familyId })
      .from(childrenTable).where(eq(childrenTable.id, emergency.childId));
    if (!child) return { kind: "missing-child" as const };
    const [family] = await tx.select({ parent1Id: familiesTable.parent1Id, parent2Id: familiesTable.parent2Id })
      .from(familiesTable).where(eq(familiesTable.id, child.familyId));
    if (!family) return { kind: "missing-family" as const };

    const [existing] = await tx.select({
      id: emergencyUpdatesTable.id,
      familyStatus: emergencyUpdatesTable.familyStatus,
      familyInstructions: emergencyUpdatesTable.familyInstructions,
      publishedAt: emergencyUpdatesTable.publishedAt,
    }).from(emergencyUpdatesTable).where(and(
      eq(emergencyUpdatesTable.emergencyId, id),
      eq(emergencyUpdatesTable.eventId, eventId),
    ));
    if (existing?.familyStatus && existing.familyInstructions && existing.publishedAt) {
      return { kind: "published" as const, replayed: true, update: existing, child };
    }

    const publishedAt = new Date();
    const [update] = await tx.insert(emergencyUpdatesTable).values({
      emergencyId: id, userId: req.user!.userId,
      // Never place internal incident content in family-visible columns.
      message: "Reviewed family update published", updateType: "update",
      familyStatus, familyInstructions, publishedAt, publishedBy: req.user!.userId, eventId,
    }).returning({ id: emergencyUpdatesTable.id, familyStatus: emergencyUpdatesTable.familyStatus,
      familyInstructions: emergencyUpdatesTable.familyInstructions, publishedAt: emergencyUpdatesTable.publishedAt });

    for (const parentId of new Set([family.parent1Id, family.parent2Id].filter((value): value is number => value != null))) {
      await createNotificationDelivery(tx, {
        logicalIdentity: `emergency:${id}:family-update:${eventId}:recipient:${parentId}`,
        domainType: "emergency", domainIdentifier: `${id}:family-update:${eventId}`,
        projection: {
          userId: parentId, type: "emergency_family_update",
          title: "Emergency update for your child",
          message: `${familyStatus}\n\n${familyInstructions}`,
          metadata: { emergencyId: id, childId: emergency.childId, eventId },
        },
        // Safety messages are required; the delivery worker intentionally
        // sends this SMS even when all optional channels are disabled.
        channels: ["sms"], templateKey: "emergency_family_update",
        templateMetadata: { emergencyId: id, childId: emergency.childId },
      });
    }
    return { kind: "published" as const, replayed: false, update, child };
  });
  if (result.kind === "missing") {
    res.status(404).json({ error: "Not found", message: "Emergency not found" });
    return;
  }
  if (result.kind === "closed") {
    res.status(409).json({ error: "Conflict", message: "Cannot publish a family update for a closed or resolved emergency" });
    return;
  }
  if (result.kind === "unlinked") {
    res.status(400).json({ error: "Bad request", message: "A family update requires an emergency linked to one child" });
    return;
  }
  if (result.kind === "missing-child" || result.kind === "missing-family") {
    res.status(404).json({ error: "Not found", message: "Linked child or family not found" });
    return;
  }
  res.status(result.replayed ? 200 : 201).json(ListFamilyEmergencyUpdatesResponseItem.parse(toFamilyEmergencyUpdateDto({
    id: result.update.id,
    emergencyId: id,
    childId: result.child.id,
    childFirstName: result.child.firstName,
    familyStatus: result.update.familyStatus!,
    familyInstructions: result.update.familyInstructions!,
    publishedAt: result.update.publishedAt!,
  })));
});

router.post("/emergencies/:id/all-clear", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const { notes } = req.body as { notes?: string };
  const allClearMsg = notes
    ? `The emergency has been resolved. ${notes}`
    : "The emergency situation has been fully resolved. All children are safe. Normal operations resuming.";
  // AUTHORITATIVE: resolution + audit update. REQUIRED TRANSACTIONAL OUTBOX/INTENT:
  // all-clear deliveries. RESPONSE ENRICHMENT runs before commit.
  const emergency = await db.transaction(async tx => {
    const [current] = await tx.select().from(emergenciesTable)
      .where(eq(emergenciesTable.id, id)).for("update");
    if (!current) return null;
    if (current.status === "resolved") return formatEmergency(current, tx);
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
    return formatEmergency(resolved, tx);
  });
  if (!emergency) { res.status(404).json({ error: "Not found", message: "Emergency not found" }); return; }

  res.json(emergency);
});

router.get("/emergencies/:id/updates", authMiddleware, requireRoles(...STAFF_ROLES), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const updates = await db.select().from(emergencyUpdatesTable)
    .where(eq(emergencyUpdatesTable.emergencyId, id))
    .orderBy(emergencyUpdatesTable.createdAt);
  const formatted = await Promise.all(updates.map(update => formatUpdate(update)));
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
