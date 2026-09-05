import { Router, type Request, type Response } from "express";
import { eq, and, inArray, or } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { db, pickupDelegatesTable, childrenTable, familiesTable, usersTable, notificationsTable } from "@workspace/db";
import { CreatePickupDelegateBody, VerifyDelegateOtpBody, ListPickupDelegatesQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { smsDelegateOtp } from "../services/sms";
import { notifyTeachersDelegatePickup } from "../lib/notify";
import { createNotificationDelivery } from "../services/notificationOutbox";
import { getParentChildIds as getOwnedChildIds } from "../lib/parentScope";
import { assertObjectCanBind, bindObjectToResource } from "../lib/privateObjectAccess";
import { canOperatePickupDelegates } from "../lib/routeAuthorization";
import {
  classifyCommandOperation, findCommandOperation, fingerprintCommandPayload,
  lockCommandOperation, persistCommandOperation,
} from "../services/commandOperations";

const createDelegateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Too many delegate OTPs created. Please try again later." },
  keyGenerator: (req) => req.user?.userId != null ? `user-${req.user.userId}` : "anonymous",
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Too many OTP attempts. Please wait 15 minutes before trying again." },
});

const router = Router();
const pickupDelegateRoles = requireRoles("parent", "support", "admin", "super_admin");

export const pickupDelegateRouteDependencies = {
  createNotificationDelivery,
  smsDelegateOtp,
  beforePersist: null as null | (() => void | Promise<void>),
  postCommitBeforeResponse: null as null | ((req: Request, res: Response) => void),
};

const PICKUP_DELEGATE_COMMAND = "pickup_delegate_create";
const PICKUP_DELEGATE_TARGET = "child_set";
const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class PickupDelegatePhotoBindingError extends Error {}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendPickupDelegateOtpAfterCommit(
  input: { phone: string | null | undefined; name: string; childNames: string; otp: string; delegateIds: number[] },
  log: { warn(context: unknown, message: string): unknown },
  sendOtp: typeof smsDelegateOtp = pickupDelegateRouteDependencies.smsDelegateOtp,
): Promise<void> {
  try {
    await sendOtp(input.phone, input.name, input.childNames, input.otp, log as any);
  } catch (error) {
    log.warn({ err: error, delegateIds: input.delegateIds }, "Delegate OTP SMS failed after delegate creation committed");
  }
}

/** Returns the set of childIds belonging to the authenticated parent (all owned families), or null if not a parent. */
async function getParentChildIds(userId: number, role: string): Promise<number[] | null> {
  if (role !== "parent") return null;
  return getOwnedChildIds(userId);
}

async function replayPickupDelegateOperation(tx: any, resultVersion: number, resultJson: unknown, expectedChildIds: number[]) {
  const value = resultJson as { primaryId?: unknown; createdIds?: unknown; childIds?: unknown };
  if (resultVersion !== 1 || !Number.isInteger(value?.primaryId) || !Array.isArray(value?.createdIds) || !Array.isArray(value?.childIds)
    || !value.createdIds.every(Number.isInteger) || !value.childIds.every(Number.isInteger)
    || value.childIds.join(",") !== expectedChildIds.join(",")) {
    throw new Error("Unsupported pickup delegate operation result");
  }
  const [delegate] = await tx.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, value.primaryId as number));
  if (!delegate || delegate.childId !== expectedChildIds[0]) throw new Error("Completed pickup delegate result is missing");
  const rows = await tx.select({ id: pickupDelegatesTable.id, childId: pickupDelegatesTable.childId }).from(pickupDelegatesTable)
    .where(inArray(pickupDelegatesTable.id, value.createdIds as number[]));
  if (rows.length !== value.createdIds.length || (rows as { childId: number }[]).map(row => row.childId).sort((a, b) => a - b).join(",") !== expectedChildIds.join(",")) {
    throw new Error("Completed pickup delegate result is missing");
  }
  return { kind: "complete" as const, replayed: true, delegate, childIds: value.childIds as number[],
    createdIds: value.createdIds as number[], childNames: "" };
}

router.get("/pickup-delegates", authMiddleware, pickupDelegateRoles, async (req, res): Promise<void> => {
  const params = ListPickupDelegatesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { childId } = params.data;

  // Parents can only see delegates for their own children
  const ownChildIds = await getParentChildIds(req.user!.userId, req.user!.role);
  if (ownChildIds !== null) {
    if (childId && !ownChildIds.includes(childId)) {
      res.status(403).json({ error: "Forbidden", message: "Access denied" }); return;
    }
    const filterIds = childId ? [childId] : ownChildIds;
    if (filterIds.length === 0) { res.json([]); return; }
    const delegates = await db.select().from(pickupDelegatesTable)
      .where(inArray(pickupDelegatesTable.childId, filterIds));
    res.json(delegates.map(d => ({ ...d, otpCode: undefined })));
    return;
  }

  // Explicit operational roles: normal filter
  const conditions = childId ? [eq(pickupDelegatesTable.childId, childId)] : [];
  const delegates = await db.select().from(pickupDelegatesTable)
    .where(conditions.length ? and(...conditions) : undefined);
  res.json(delegates.map(d => ({ ...d, otpCode: undefined })));
});

router.post("/pickup-delegates", authMiddleware, pickupDelegateRoles, createDelegateLimiter, async (req, res): Promise<void> => {
  const parsed = CreatePickupDelegateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const rawIds = Array.isArray((req.body as any)?.childIds) ? (req.body as any).childIds : null;
  if (rawIds && (!rawIds.length || rawIds.some((id: unknown) => !Number.isInteger(id) || (id as number) <= 0))) {
    res.status(400).json({ error: "Bad request", message: "childIds must contain positive integer IDs" }); return;
  }
  const childIds = [...new Set((rawIds ?? [parsed.data.childId]) as number[])].sort((a, b) => a - b);
  if (childIds.length > 10) {
    res.status(400).json({ error: "Bad request", message: "A delegate can cover at most 10 children at once" });
    return;
  }
  const input = { childIds, name: parsed.data.name.trim(), phone: parsed.data.phone.trim(), photoUrl: parsed.data.photoUrl ?? null };
  if (!input.name || !input.phone) { res.status(400).json({ error: "Bad request", message: "name and phone cannot be blank" }); return; }
  const binding = { actorUserId: req.user!.userId, command: PICKUP_DELEGATE_COMMAND, targetType: PICKUP_DELEGATE_TARGET,
    targetId: childIds.join(","), payloadFingerprint: fingerprintCommandPayload(input) };
  let result: any;
  try {
    result = await db.transaction(async tx => {
    await lockCommandOperation(tx, parsed.data.operationId);
    const existing = await findCommandOperation(tx, parsed.data.operationId);
    const classification = classifyCommandOperation(existing, binding);
    if (classification === "collision") return { kind: "collision" as const };
    if (classification === "replay") return replayPickupDelegateOperation(tx, existing!.resultVersion, existing!.resultJson, childIds);
    const children = await tx.select().from(childrenTable).where(inArray(childrenTable.id, childIds));
    if (children.length !== childIds.length) return { kind: "child_missing" as const };
    if (req.user!.role === "parent") {
      const owned = await tx.select({ id: childrenTable.id }).from(childrenTable).innerJoin(familiesTable, eq(childrenTable.familyId, familiesTable.id))
        .where(and(inArray(childrenTable.id, childIds), or(eq(familiesTable.parent1Id, req.user!.userId), eq(familiesTable.parent2Id, req.user!.userId))));
      if (owned.length !== childIds.length) return { kind: "unauthorized" as const };
    }
    if (!await assertObjectCanBind(input.photoUrl, req.user!, tx)) return { kind: "photo_denied" as const };
    const otp = generateOTP();
    const inserted = await tx.insert(pickupDelegatesTable).values(childIds.map(childId => ({ ...input, childId, otpCode: otp,
      otpExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), parentApproved: false }))).returning();
    if (!await bindObjectToResource(input.photoUrl, "pickup_delegate", inserted[0].id, req.user!, tx)) {
      throw new PickupDelegatePhotoBindingError();
    }
    await pickupDelegateRouteDependencies.beforePersist?.();
    const createdIds = inserted.map(delegate => delegate.id);
    await persistCommandOperation(tx, { operationId: parsed.data.operationId, ...binding, primaryId: inserted[0].id, resultVersion: 1,
      resultJson: { primaryId: inserted[0].id, createdIds, childIds } });
    return { kind: "complete" as const, replayed: false, delegate: inserted[0], childIds, createdIds,
      childNames: children.map(child => `${child.firstName} ${child.lastName}`).join(", ") || "your child" };
    });
  } catch (error) {
    if (error instanceof PickupDelegatePhotoBindingError) {
      res.status(403).json({ error: "Forbidden", message: "This uploaded photo cannot be attached to this delegate" });
      return;
    }
    throw error;
  }
  if (result.kind === "collision") { res.status(409).json({ error: "Conflict", message: "operationId is bound to different command input" }); return; }
  if (result.kind === "child_missing") { res.status(400).json({ error: "Bad request", message: "One or more selected children were not found" }); return; }
  if (result.kind === "unauthorized" || result.kind === "photo_denied") { res.status(403).json({ error: "Forbidden", message: result.kind === "photo_denied" ? "This uploaded photo cannot be attached to this delegate" : "You can only create pickup delegates for your own children" }); return; }
  if (!result.replayed && result.delegate.otpCode) await sendPickupDelegateOtpAfterCommit({ phone: result.delegate.phone, name: result.delegate.name,
    childNames: result.childNames, otp: result.delegate.otpCode, delegateIds: result.createdIds }, req.log);
  pickupDelegateRouteDependencies.postCommitBeforeResponse?.(req, res);
  if (res.destroyed || res.socket?.destroyed) return;
  const expired = !!result.delegate.otpExpiresAt && new Date() > result.delegate.otpExpiresAt;
  res.status(result.replayed ? 200 : 201).json({ ...result.delegate, otpCode: expired ? null : result.delegate.otpCode,
    otpStatus: expired ? "expired" : "active", childIds: result.childIds, operationId: parsed.data.operationId,
    outcome: result.replayed ? "already_applied" : "applied" });
});

router.get("/pickup-delegates/operations/:operationId", authMiddleware, pickupDelegateRoles, async (req, res): Promise<void> => {
  const operationId = req.params.operationId as string;
  if (!OPERATION_ID_PATTERN.test(operationId)) { res.status(400).json({ error: "Bad request", message: "Invalid operation identity" }); return; }
  const result = await db.transaction(async tx => {
    await lockCommandOperation(tx, operationId);
    const operation = await findCommandOperation(tx, operationId);
    if (!operation || operation.actorUserId !== req.user!.userId || operation.command !== PICKUP_DELEGATE_COMMAND
      || operation.targetType !== PICKUP_DELEGATE_TARGET) return null;
    const childIds: number[] = operation.targetId.split(",").map(Number);
    if (!childIds.length || childIds.some(id => !Number.isInteger(id))) return null;
    if (req.user!.role === "parent") {
      const owned = await tx.select({ id: childrenTable.id }).from(childrenTable).innerJoin(familiesTable, eq(childrenTable.familyId, familiesTable.id))
        .where(and(inArray(childrenTable.id, childIds), or(eq(familiesTable.parent1Id, req.user!.userId), eq(familiesTable.parent2Id, req.user!.userId))));
      if (owned.length !== childIds.length) return null;
    }
    return replayPickupDelegateOperation(tx, operation.resultVersion, operation.resultJson, childIds);
  });
  if (!result) { res.status(404).json({ error: "Not found", message: "Operation not found" }); return; }
  const expired = !!result.delegate.otpExpiresAt && new Date() > result.delegate.otpExpiresAt;
  res.json({ ...result.delegate, otpCode: expired ? null : result.delegate.otpCode, otpStatus: expired ? "expired" : "active",
    childIds: result.childIds, operationId, outcome: "already_applied" });
});

router.post("/pickup-delegates/verify-otp", verifyOtpLimiter, async (req, res): Promise<void> => {
  const parsed = VerifyDelegateOtpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { otpCode } = parsed.data;
  // An OTP may cover multiple children (one delegate row per child sharing the code)
  const matches = await db.select().from(pickupDelegatesTable)
    .where(eq(pickupDelegatesTable.otpCode, otpCode));
  const delegate = matches[0];
  if (!delegate) {
    res.json({ valid: false, delegate: null, child: null, message: "Invalid OTP" });
    return;
  }
  if (delegate.otpExpiresAt && new Date() > delegate.otpExpiresAt) {
    res.json({ valid: false, delegate: null, child: null, message: "OTP has expired" });
    return;
  }
  const childIds = matches.map(m => m.childId);
  const children = await db.select().from(childrenTable).where(inArray(childrenTable.id, childIds));
  // `child` stays for backwards compatibility; `children` lists all covered by this OTP
  res.json({
    valid: true,
    delegate: { ...delegate, otpCode: undefined },
    child: children.find(c => c.id === delegate.childId) ?? null,
    children,
    message: "OTP verified",
  });
});

/** Checks parent ownership or an explicit operational delegate role. */
async function assertParentOwnsDelegateOrOperational(
  delegateChildId: number,
  userId: number,
  role: string,
  res: import("express").Response,
): Promise<boolean> {
  const ownChildIds = await getParentChildIds(userId, role);
  if (ownChildIds === null && canOperatePickupDelegates(role)) return true;
  if (ownChildIds === null) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return false;
  }
  if (!ownChildIds.includes(delegateChildId)) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return false;
  }
  return true;
}

router.get("/pickup-delegates/:id", authMiddleware, pickupDelegateRoles, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [delegate] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await assertParentOwnsDelegateOrOperational(delegate.childId, req.user!.userId, req.user!.role, res)) return;
  res.json({ ...delegate, otpCode: undefined });
});

router.put("/pickup-delegates/:id/approve", authMiddleware, pickupDelegateRoles, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [existing] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await assertParentOwnsDelegateOrOperational(existing.childId, req.user!.userId, req.user!.role, res)) return;
  // Approval applies to the whole OTP group (one code may cover several children)
  const group = await getDelegateGroup(existing);
  const wasAlreadyApproved = group.every(g => g.approvalStatus === "approved");
  const updated = await db.update(pickupDelegatesTable)
    .set({ parentApproved: true, approvalStatus: "approved" })
    .where(inArray(pickupDelegatesTable.id, group.map(g => g.id))).returning();
  const delegate = updated.find(d => d.id === id) ?? updated[0];
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  // Only notify teachers on the actual transition to approved — retries stay silent
  if (!wasAlreadyApproved) {
    notifyTeachersDelegatePickup(group.map(g => g.childId), delegate.name, "approved").catch(() => {});
  }
  res.json({ ...delegate, otpCode: undefined });
});

/** Returns all delegate rows in the same OTP group (rows created together sharing one code), including the row itself. */
async function getDelegateGroup(delegate: typeof pickupDelegatesTable.$inferSelect) {
  if (!delegate.otpCode) return [delegate];
  const siblings = await db.select().from(pickupDelegatesTable)
    .where(eq(pickupDelegatesTable.otpCode, delegate.otpCode));
  return siblings.length ? siblings : [delegate];
}

router.post("/pickup-delegates/:id/notify-parent", authMiddleware, pickupDelegateRoles, async (req, res): Promise<void> => {
  // Classification: the pending approval state and parent notification records
  // are AUTHORITATIVE and REQUIRED TRANSACTIONAL OUTBOX/INTENT respectively;
  // recipient/child/group reads are REQUIRED PRE-COMMIT VALIDATION; the teacher
  // heads-up is an OPTIONAL SECONDARY EFFECT.
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [delegate] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await assertParentOwnsDelegateOrOperational(delegate.childId, req.user!.userId, req.user!.role, res)) return;

  // The OTP may cover multiple children — approval applies to the whole group.
  const group = await getDelegateGroup(delegate);
  const groupChildIds = group.map(g => g.childId);
  const children = await db.select().from(childrenTable).where(inArray(childrenTable.id, groupChildIds));
  if (children.length === 0) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }
  const childNames = children.map(c => `${c.firstName} ${c.lastName}`).join(", ");

  // Notify BOTH parents of every family involved (either may approve).
  const familyIds = [...new Set(children.map(c => c.familyId).filter(Boolean))] as number[];
  let parentUserIds: number[] = [];
  if (familyIds.length) {
    const families = await db.select().from(familiesTable).where(inArray(familiesTable.id, familyIds));
    parentUserIds = [...new Set(families.flatMap(f => [f.parent1Id, f.parent2Id]).filter(Boolean))] as number[];
  }
  if (parentUserIds.length === 0) { res.status(404).json({ error: "Not found", message: "Parent not found for this child" }); return; }

  const metadata = { delegateId: id, childId: children[0].id, childIds: groupChildIds, delegateName: delegate.name, requiresApproval: true };
  const groupIdentity = Math.min(...group.map(g => g.id));
  await db.transaction(async tx => {
    await tx.update(pickupDelegatesTable)
      .set({ approvalStatus: "pending", approvalRequestedAt: new Date() })
      .where(inArray(pickupDelegatesTable.id, group.map(g => g.id)));
    for (const parentUserId of parentUserIds) {
      await pickupDelegateRouteDependencies.createNotificationDelivery(tx, {
        logicalIdentity: `delegate-approval:${groupIdentity}:recipient:${parentUserId}`,
        domainType: "pickup_delegate",
        domainIdentifier: String(groupIdentity),
        projection: {
          userId: parentUserId,
          type: "delegate_approval_request",
          title: `🔔 Approve Pickup: ${children.length > 1 ? `${children.length} children` : children[0].firstName}`,
          message: `${delegate.name} is at the front desk to collect ${childNames}. Please approve or deny this pickup request.`,
          metadata,
        },
        channels: ["whatsapp"],
        templateKey: "delegate_approval_request",
        templateMetadata: metadata,
      });
    }
  });

  // Also warn the class teacher(s) so they can prepare — but not release yet
  notifyTeachersDelegatePickup(group.map(g => g.childId), delegate.name, "arrived").catch(error => {
    req.log.warn({ err: error, delegateId: id }, "Teacher delegate-arrival notification failed after approval request committed");
  });

  res.json({ success: true, requiresApproval: true, message: `Parent notified. Waiting for their approval before releasing ${childNames}.` });
});

/** Returns true if the user is authorised to approve/deny this delegate pickup.
 *  Authorised if: an explicit operational role, OR parent owns the child, OR the system sent them
 *  a delegate_approval_request notification for this specific delegate. */
async function canActOnDelegateApproval(delegateId: number, childId: number, userId: number, role: string): Promise<boolean> {
  // Explicit operational roles are allowed.
  if (role !== "parent") return canOperatePickupDelegates(role);
  // Parent owns the child: allowed
  const ownChildIds = await getParentChildIds(userId, role);
  if (ownChildIds && ownChildIds.includes(childId)) return true;
  // Parent was specifically notified about this delegate: allowed
  const notifs = await db.select().from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.type, "delegate_approval_request")));
  return notifs.some(n => {
    try { return JSON.parse(n.metadataJson || "{}").delegateId === delegateId; } catch { return false; }
  });
}

router.post("/pickup-delegates/:id/approve", authMiddleware, pickupDelegateRoles, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [delegate] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await canActOnDelegateApproval(id, delegate.childId, req.user!.userId, req.user!.role)) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" }); return;
  }

  const group = await getDelegateGroup(delegate);
  const wasAlreadyApproved = group.every(g => g.approvalStatus === "approved");
  const updatedRows = await db.update(pickupDelegatesTable)
    .set({ parentApproved: true, approvalStatus: "approved" })
    .where(inArray(pickupDelegatesTable.id, group.map(g => g.id))).returning();
  const updated = updatedRows.find(d => d.id === id) ?? updatedRows[0];

  // Only notify teachers on the actual transition to approved — retries stay silent
  if (!wasAlreadyApproved) {
    notifyTeachersDelegatePickup(group.map(g => g.childId), delegate.name, "approved").catch(() => {});
  }
  res.json({ success: true, delegate: updated, message: "Pickup approved. Child may be released." });
});

router.post("/pickup-delegates/:id/deny", authMiddleware, pickupDelegateRoles, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [delegate] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await canActOnDelegateApproval(id, delegate.childId, req.user!.userId, req.user!.role)) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" }); return;
  }

  const group = await getDelegateGroup(delegate);
  const updatedRows = await db.update(pickupDelegatesTable)
    .set({ approvalStatus: "denied" })
    .where(inArray(pickupDelegatesTable.id, group.map(g => g.id))).returning();
  const updated = updatedRows.find(d => d.id === id) ?? updatedRows[0];

  res.json({ success: true, delegate: updated, message: "Pickup denied. Front desk has been notified." });
});

router.delete("/pickup-delegates/:id", authMiddleware, pickupDelegateRoles, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [existing] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await assertParentOwnsDelegateOrOperational(existing.childId, req.user!.userId, req.user!.role, res)) return;

  await db.delete(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));

  res.json({ success: true, message: "Delegate removed successfully" });
});

export default router;
