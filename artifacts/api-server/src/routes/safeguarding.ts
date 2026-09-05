import { Router, type Request, type Response } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, safeguardingRecordsTable, usersTable } from "@workspace/db";
import { CreateSafeguardingRecordBody } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { z } from "zod";
import {
  classifyCommandOperation,
  findCommandOperation,
  fingerprintCommandPayload,
  lockCommandOperation,
  persistCommandOperation,
  replayCommandResult,
} from "../services/commandOperations";

const router = Router();
const SAFEGUARDING_CREATE_COMMAND = "safeguarding_record_create";
const SAFEGUARDING_TEACHER_TARGET = "teacher";
const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const safeguardingRouteDependencies: {
  beforePersist: null | (() => void | Promise<void>);
  postCommitBeforeResponse: null | ((req: Request, res: Response) => void);
} = {
  beforePersist: null,
  postCommitBeforeResponse: null,
};

const CreateRecordBody = z.object({
  teacherUserId: z.number(),
  checkType: z.string().min(1),
  referenceNumber: z.string().optional(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  status: z.enum(["clear", "pending", "expired", "not_submitted"]).default("pending"),
  notes: z.string().optional(),
});

const UpdateRecordBody = CreateRecordBody.partial().omit({ teacherUserId: true });

async function isEligibleTeacher(executor: any, userId: number): Promise<boolean> {
  const [teacher] = await executor.select({
    role: usersTable.role,
    status: usersTable.status,
    isActive: usersTable.isActive,
  }).from(usersTable).where(eq(usersTable.id, userId));
  return !!teacher && teacher.role === "teacher" && teacher.status === "active" && teacher.isActive;
}

async function isCurrentlyAuthorizedAdministrator(executor: any, userId: number, role: string): Promise<boolean> {
  const [actor] = await executor.select({
    role: usersTable.role,
    status: usersTable.status,
    isActive: usersTable.isActive,
    secondaryRoles: usersTable.secondaryRoles,
  }).from(usersTable).where(eq(usersTable.id, userId));
  if (!actor || !actor.isActive || actor.status !== "active") return false;
  let secondaryRoles: string[] = [];
  try {
    const parsed = JSON.parse(actor.secondaryRoles || "[]");
    if (Array.isArray(parsed)) secondaryRoles = parsed.filter((value): value is string => typeof value === "string");
  } catch { /* malformed legacy secondary roles grant nothing */ }
  return ["admin", "super_admin"].includes(role) && (actor.role === role || secondaryRoles.includes(role));
}

async function formatRecordWith(executor: any, r: typeof safeguardingRecordsTable.$inferSelect) {
  const [teacher] = await executor.select().from(usersTable).where(eq(usersTable.id, r.teacherUserId));
  return {
    ...r,
    teacher: teacher ? { id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email } : null,
    isExpiringSoon: r.expiryDate ? (() => {
      const exp = new Date(r.expiryDate);
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      return exp <= in30 && exp >= new Date();
    })() : false,
    isExpired: r.expiryDate ? new Date(r.expiryDate) < new Date() : false,
  };
}

async function formatRecord(r: typeof safeguardingRecordsTable.$inferSelect) {
  return formatRecordWith(db, r);
}

router.get("/safeguarding", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const records = await db.select().from(safeguardingRecordsTable).orderBy(desc(safeguardingRecordsTable.createdAt));
  const formatted = await Promise.all(records.map(formatRecord));
  res.json(formatted);
});

router.get("/safeguarding/expiring", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const records = await db.select().from(safeguardingRecordsTable).orderBy(desc(safeguardingRecordsTable.createdAt));
  const formatted = await Promise.all(records.map(formatRecord));
  const expiring = formatted.filter(r => r.isExpiringSoon || r.isExpired);
  res.json(expiring);
});

router.get("/safeguarding/teacher/:teacherUserId", authMiddleware, async (req, res): Promise<void> => {
  const teacherUserId = parseInt(req.params.teacherUserId as string, 10);
  if (isNaN(teacherUserId)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const role = req.user!.role;
  if (role === "teacher" && req.user!.userId !== teacherUserId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const records = await db.select().from(safeguardingRecordsTable)
    .where(eq(safeguardingRecordsTable.teacherUserId, teacherUserId))
    .orderBy(desc(safeguardingRecordsTable.createdAt));
  const formatted = await Promise.all(records.map(formatRecord));
  res.json(formatted);
});

router.post("/safeguarding", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const parsed = CreateSafeguardingRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const data = {
    ...parsed.data,
    checkType: parsed.data.checkType.trim(),
    status: parsed.data.status ?? "pending",
  };
  if (!data.checkType) { res.status(400).json({ error: "Bad request", message: "checkType cannot be blank" }); return; }
  const binding = {
    actorUserId: req.user!.userId,
    command: SAFEGUARDING_CREATE_COMMAND,
    targetType: SAFEGUARDING_TEACHER_TARGET,
    targetId: String(data.teacherUserId),
    payloadFingerprint: fingerprintCommandPayload({
      checkType: data.checkType,
      referenceNumber: data.referenceNumber ?? null,
      issuedDate: data.issuedDate ?? null,
      expiryDate: data.expiryDate ?? null,
      status: data.status,
      notes: data.notes ?? null,
    }),
  };
  const result = await db.transaction(async tx => {
    // This precedes target validation and every domain read/lock, so a shared
    // operation ID can never run two safeguarding mutations concurrently.
    await lockCommandOperation(tx, data.operationId);
    if (!await isCurrentlyAuthorizedAdministrator(tx, req.user!.userId, req.user!.role)) {
      return { kind: "unauthorized" as const };
    }
    const existing = await findCommandOperation(tx, data.operationId);
    const classification = classifyCommandOperation(existing, binding);
    if (classification === "collision") return { kind: "collision" as const };
    if (classification === "replay") {
      const { primaryId } = replayCommandResult(existing!);
      const [record] = await tx.select().from(safeguardingRecordsTable).where(and(
        eq(safeguardingRecordsTable.id, primaryId),
        eq(safeguardingRecordsTable.teacherUserId, data.teacherUserId),
      ));
      if (!record) throw new Error("Completed safeguarding result is missing");
      return { kind: "complete" as const, replayed: true, record: await formatRecordWith(tx, record) };
    }
    if (!await isEligibleTeacher(tx, data.teacherUserId)) return { kind: "ineligible_teacher" as const };
    const [created] = await tx.insert(safeguardingRecordsTable).values({
      teacherUserId: data.teacherUserId,
      checkType: data.checkType,
      referenceNumber: data.referenceNumber ?? null,
      issuedDate: data.issuedDate ?? null,
      expiryDate: data.expiryDate ?? null,
      status: data.status,
      notes: data.notes ?? null,
      createdBy: req.user!.userId,
    }).returning();
    await safeguardingRouteDependencies.beforePersist?.();
    await persistCommandOperation(tx, { operationId: data.operationId, ...binding, primaryId: created.id, resultVersion: 1 });
    return { kind: "complete" as const, replayed: false, record: await formatRecordWith(tx, created) };
  });
  if (result.kind === "unauthorized") { res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" }); return; }
  if (result.kind === "collision") { res.status(409).json({ error: "Conflict", message: "operationId is bound to different command input" }); return; }
  if (result.kind === "ineligible_teacher") { res.status(400).json({ error: "Bad request", message: "teacherUserId must identify an active teacher" }); return; }
  safeguardingRouteDependencies.postCommitBeforeResponse?.(req, res);
  if (res.destroyed || res.socket?.destroyed) return;
  res.status(result.replayed ? 200 : 201).json({
    ...result.record,
    operationId: data.operationId,
    outcome: result.replayed ? "already_applied" : "applied",
  });
});

router.get("/safeguarding/operations/:operationId", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const operationId = req.params.operationId as string;
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    res.status(400).json({ error: "Bad request", message: "Invalid operation identity" });
    return;
  }
  const record = await db.transaction(async tx => {
    await lockCommandOperation(tx, operationId);
    if (!await isCurrentlyAuthorizedAdministrator(tx, req.user!.userId, req.user!.role)) return null;
    const operation = await findCommandOperation(tx, operationId);
    if (!operation
      || operation.actorUserId !== req.user!.userId
      || operation.command !== SAFEGUARDING_CREATE_COMMAND
      || operation.targetType !== SAFEGUARDING_TEACHER_TARGET) return null;
    const { primaryId } = replayCommandResult(operation);
    const [result] = await tx.select().from(safeguardingRecordsTable).where(and(
      eq(safeguardingRecordsTable.id, primaryId),
      eq(safeguardingRecordsTable.teacherUserId, Number(operation.targetId)),
    ));
    return result ? formatRecordWith(tx, result) : null;
  });
  if (!record) { res.status(404).json({ error: "Not found", message: "Operation not found" }); return; }
  res.json({ ...record, operationId, outcome: "already_applied" });
});

router.put("/safeguarding/:id", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = UpdateRecordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const record = await db.transaction(async tx => {
    const [updated] = await tx.update(safeguardingRecordsTable).set({
      ...parsed.data,
      updatedAt: new Date(),
    }).where(eq(safeguardingRecordsTable.id, id)).returning();
    return updated ? formatRecordWith(tx, updated) : null;
  });
  if (!record) { res.status(404).json({ error: "Not found", message: "Record not found" }); return; }
  res.json(record);
});

router.delete("/safeguarding/:id", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  await db.delete(safeguardingRecordsTable).where(eq(safeguardingRecordsTable.id, id));
  res.json({ ok: true });
});

export default router;
