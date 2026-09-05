import { Router, type Request, type Response } from "express";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { db, familiesTable, usersTable, childrenTable, classesTable, attendanceTable, pickupDelegatesTable } from "@workspace/db";
import { CreateFamilyAssistDelegateBody } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { findActiveOtherSlot, stillCheckedInMessage } from "../lib/attendanceGuards";
import { smsDelegateOtp } from "../services/sms";
import { createAttendanceNotificationIntents } from "../lib/attendanceNotificationIntents";
import {
  classifyCommandOperation,
  findCommandOperation,
  fingerprintCommandPayload,
  lockCommandOperation,
  persistCommandOperation,
  replayCommandResult,
} from "../services/commandOperations";

const router = Router();

export const familyAssistRouteDependencies: {
  smsDelegateOtp: typeof smsDelegateOtp;
  beforePersist: null | (() => void | Promise<void>);
  postCommitBeforeResponse: null | ((req: Request, res: Response) => void);
} = {
  smsDelegateOtp,
  beforePersist: null,
  postCommitBeforeResponse: null,
};

const FAMILY_ASSIST_ROLES = ["super_admin", "admin", "support"] as const;
const FAMILY_ASSIST_DELEGATE_COMMAND = "family_assist_delegate_create";
const FAMILY_ASSIST_DELEGATE_TARGET = "child";
const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateGuestCode(): string {
  return "G-" + Math.floor(1000 + Math.random() * 9000).toString();
}

export async function sendAssistedDelegateOtpAfterCommit(
  input: { phone: string; name: string; childName: string; otp: string; delegateId: number },
  log: { warn(context: unknown, message: string): unknown },
  sendOtp: typeof smsDelegateOtp = familyAssistRouteDependencies.smsDelegateOtp,
): Promise<void> {
  try {
    await sendOtp(input.phone, input.name, input.childName, input.otp, log as any);
  } catch (error) {
    log.warn({ err: error, delegateId: input.delegateId }, "Assisted delegate OTP SMS failed after delegate creation committed");
  }
}

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

async function isCurrentlyAuthorizedFamilyAssistStaff(executor: any, userId: number, role: string): Promise<boolean> {
  const [user] = await executor.select({
    role: usersTable.role,
    secondaryRoles: usersTable.secondaryRoles,
    status: usersTable.status,
    isActive: usersTable.isActive,
  }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !user.isActive || user.status !== "active" || !FAMILY_ASSIST_ROLES.includes(role as any)) return false;
  try {
    const secondaryRoles = JSON.parse(user.secondaryRoles || "[]");
    return user.role === role || (Array.isArray(secondaryRoles) && secondaryRoles.includes(role));
  } catch {
    return user.role === role;
  }
}

function familyAssistDelegateResponse(delegate: typeof pickupDelegatesTable.$inferSelect) {
  const expired = !!delegate.otpExpiresAt && new Date() > delegate.otpExpiresAt;
  return {
    ...delegate,
    // The durable code may be recovered only by the original currently
    // authorized staff actor through this route's replay/reconciliation.
    otpCode: expired ? null : delegate.otpCode,
    otpStatus: expired ? "expired" as const : "active" as const,
  };
}

router.get("/family-assist/search", authMiddleware, requireRoles("super_admin", "admin", "support"), async (req, res): Promise<void> => {
  const q = ((req.query.q as string) || "").trim();
  if (!q) { res.json([]); return; }

  const matchingUsers = await db.select().from(usersTable).where(
    or(
      ilike(usersTable.firstName, `%${q}%`),
      ilike(usersTable.lastName, `%${q}%`),
      ilike(usersTable.phone, `%${q}%`),
    )
  );

  if (matchingUsers.length === 0) { res.json([]); return; }
  const userIds = matchingUsers.map(u => u.id);

  const families = await db.select().from(familiesTable).where(
    or(...userIds.flatMap(id => [
      eq(familiesTable.parent1Id, id),
      eq(familiesTable.parent2Id, id),
    ]))
  );

  const result = await Promise.all(families.map(async (fam) => {
    const parent = matchingUsers.find(u => u.id === fam.parent1Id || u.id === fam.parent2Id);
    const children = await db.select().from(childrenTable).where(eq(childrenTable.familyId, fam.id));
    const childrenWithClass = await Promise.all(children.map(async (c) => {
      let currentClass = null;
      if (c.currentClassId) {
        const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, c.currentClassId));
        currentClass = cls ?? null;
      }
      return { ...c, currentClass };
    }));
    return {
      id: fam.id,
      familyCode: fam.familyCode,
      parentName: parent ? `${parent.firstName} ${parent.lastName}` : "Unknown",
      parentPhone: parent?.phone ?? null,
      children: childrenWithClass,
    };
  }));

  res.json(result);
});

router.post("/family-assist/delegate", authMiddleware, requireRoles(...FAMILY_ASSIST_ROLES), async (req, res): Promise<void> => {
  const parsed = CreateFamilyAssistDelegateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const input = {
    childId: parsed.data.childId,
    delegateName: parsed.data.delegateName.trim(),
    delegatePhone: parsed.data.delegatePhone.trim(),
  };
  if (!input.delegateName || !input.delegatePhone) {
    res.status(400).json({ error: "Bad request", message: "delegateName and delegatePhone cannot be blank" });
    return;
  }
  const binding = {
    actorUserId: req.user!.userId,
    command: FAMILY_ASSIST_DELEGATE_COMMAND,
    targetType: FAMILY_ASSIST_DELEGATE_TARGET,
    targetId: String(input.childId),
    payloadFingerprint: fingerprintCommandPayload(input),
  };
  const result = await db.transaction(async tx => {
    // The operation lock intentionally precedes actor/child reads and every
    // command-specific write, making a UUID one logical delegate submission.
    await lockCommandOperation(tx, parsed.data.operationId);
    if (!await isCurrentlyAuthorizedFamilyAssistStaff(tx, req.user!.userId, req.user!.role)) {
      return { kind: "unauthorized" as const };
    }
    const existing = await findCommandOperation(tx, parsed.data.operationId);
    const classification = classifyCommandOperation(existing, binding);
    if (classification === "collision") return { kind: "collision" as const };
    if (classification === "replay") {
      const { primaryId } = replayCommandResult(existing!);
      const [delegate] = await tx.select().from(pickupDelegatesTable)
        .where(and(eq(pickupDelegatesTable.id, primaryId), eq(pickupDelegatesTable.childId, input.childId)));
      if (!delegate) throw new Error("Completed family assist delegate result is missing");
      return { kind: "complete" as const, replayed: true, delegate, childName: "" };
    }
    const [child] = await tx.select().from(childrenTable).where(eq(childrenTable.id, input.childId));
    if (!child) return { kind: "child_missing" as const };
    const otp = generateOTP();
    const [delegate] = await tx.insert(pickupDelegatesTable).values({
      childId: input.childId,
      name: input.delegateName,
      phone: input.delegatePhone,
      otpCode: otp,
      otpExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      // Assisted creation remains immediately parent-approved.
      parentApproved: true,
    }).returning();
    await familyAssistRouteDependencies.beforePersist?.();
    await persistCommandOperation(tx, { operationId: parsed.data.operationId, ...binding, primaryId: delegate.id, resultVersion: 1 });
    return { kind: "complete" as const, replayed: false, delegate, childName: `${child.firstName} ${child.lastName}` };
  });
  if (result.kind === "unauthorized") { res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" }); return; }
  if (result.kind === "collision") { res.status(409).json({ error: "Conflict", message: "operationId is bound to different command input" }); return; }
  if (result.kind === "child_missing") { res.status(404).json({ error: "Child not found" }); return; }
  if (!result.replayed && result.delegate.otpCode) {
    await sendAssistedDelegateOtpAfterCommit({
      phone: result.delegate.phone, name: result.delegate.name, childName: result.childName,
      otp: result.delegate.otpCode, delegateId: result.delegate.id,
    }, req.log);
  }
  familyAssistRouteDependencies.postCommitBeforeResponse?.(req, res);
  if (res.destroyed || res.socket?.destroyed) return;
  res.status(result.replayed ? 200 : 201).json({
    ...familyAssistDelegateResponse(result.delegate),
    operationId: parsed.data.operationId,
    outcome: result.replayed ? "already_applied" : "applied",
  });
});

router.get("/family-assist/delegate/operations/:operationId", authMiddleware, requireRoles(...FAMILY_ASSIST_ROLES), async (req, res): Promise<void> => {
  const operationId = req.params.operationId as string;
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    res.status(400).json({ error: "Bad request", message: "Invalid operation identity" });
    return;
  }
  const delegate = await db.transaction(async tx => {
    await lockCommandOperation(tx, operationId);
    if (!await isCurrentlyAuthorizedFamilyAssistStaff(tx, req.user!.userId, req.user!.role)) return null;
    const operation = await findCommandOperation(tx, operationId);
    if (!operation || operation.actorUserId !== req.user!.userId
      || operation.command !== FAMILY_ASSIST_DELEGATE_COMMAND || operation.targetType !== FAMILY_ASSIST_DELEGATE_TARGET) return null;
    const { primaryId } = replayCommandResult(operation);
    const [result] = await tx.select().from(pickupDelegatesTable).where(and(
      eq(pickupDelegatesTable.id, primaryId),
      eq(pickupDelegatesTable.childId, Number(operation.targetId)),
    ));
    return result ?? null;
  });
  // A non-original actor receives the same absence result and learns nothing.
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Operation not found" }); return; }
  res.json({ ...familyAssistDelegateResponse(delegate), operationId, outcome: "already_applied" });
});

router.post("/family-assist/checkin", authMiddleware, requireRoles("super_admin", "admin", "support"), async (req, res): Promise<void> => {
  const { childId, serviceSlot } = req.body as { childId?: number; serviceSlot?: string };
  if (!childId || !serviceSlot) {
    res.status(400).json({ error: "childId and serviceSlot are required" });
    return;
  }

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, Number(childId)));
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }
  if (!child.currentClassId) { res.status(400).json({ error: "Child is not assigned to a class" }); return; }
  const assignedClassId = child.currentClassId;

  const serviceDate = todayString();
  const slotsToBook = serviceSlot === "both" ? ["7am", "10:30am"] : [serviceSlot];

  // Same per-child/day advisory lock as the main check-in endpoint so
  // concurrent requests can't bypass the cross-service rule: a child still
  // checked in (not picked up) for the other service cannot be checked in
  // again until staff check them out. A deliberate "both services" booking is
  // exempt, as is re-tapping a slot the child already has a record for.
  const lockKey = Number(serviceDate.replace(/-/g, ""));
  let blockingSlot: string | null = null;
  const results: (typeof attendanceTable.$inferSelect)[] = [];
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${child.id}, ${lockKey})`);
    const dayRecords = await tx.select().from(attendanceTable)
      .where(and(eq(attendanceTable.childId, child.id), eq(attendanceTable.serviceDate, serviceDate)));
    if (serviceSlot !== "both") {
      const hasSameSlot = dayRecords.some((r) => r.serviceSlot === serviceSlot);
      blockingSlot = hasSameSlot ? null : findActiveOtherSlot(dayRecords, serviceSlot);
      if (blockingSlot) return;
    }
    for (const slot of slotsToBook) {
      const existing = dayRecords.find((r) => r.serviceSlot === slot);
      if (existing) { results.push(existing); continue; }
      const [record] = await tx.insert(attendanceTable).values({
        childId: child.id,
        classId: assignedClassId,
        serviceDate,
        serviceSlot: slot,
        checkInTime: new Date(),
        checkedInBy: req.user!.userId,
        status: "dropped_off",
      }).returning();
      await createAttendanceNotificationIntents(tx, record, "checked_in");
      results.push(record);
    }
  });
  if (blockingSlot) {
    res.status(409).json({ error: "Conflict", message: stillCheckedInMessage(blockingSlot, serviceSlot) });
    return;
  }

  res.json({ success: true, attendance: results, childName: `${child.firstName} ${child.lastName}` });
});

type GuestChild = { firstName: string; lastName: string; dob: string; gender: string };

router.post("/family-assist/guest", authMiddleware, requireRoles("super_admin", "admin", "support"), async (req, res): Promise<void> => {
  const { parentName, parentPhone, children, serviceSlot } =
    req.body as { parentName?: string; parentPhone?: string; children?: GuestChild[]; serviceSlot?: string };

  if (!parentName || !children || children.length === 0 || !serviceSlot) {
    res.status(400).json({ error: "parentName, at least one child, and serviceSlot are required" });
    return;
  }
  for (const c of children) {
    if (!c.firstName || !c.lastName || !c.dob || !c.gender) {
      res.status(400).json({ error: "Each child must have firstName, lastName, dob and gender" });
      return;
    }
  }

  const guestCode = generateGuestCode();
  const [family] = await db.insert(familiesTable).values({
    familyCode: guestCode,
    notes: `Walk-in guest. Parent: ${parentName}${parentPhone ? `, Phone: ${parentPhone}` : ""}`,
    isGuest: true,
  }).returning();

  const allClasses = await db.select().from(classesTable);
  const serviceDate = todayString();
  const slotsToBook = serviceSlot === "both" ? ["7am", "10:30am"] : [serviceSlot];

  function calcAge(dob: string): number {
    const birth = new Date(dob);
    const now = new Date();
    return now.getFullYear() - birth.getFullYear() -
      (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  }

  const createdChildren = [];
  for (const c of children) {
    const age = calcAge(c.dob);
    const matchByAge = allClasses.find(cls =>
      cls.ageMin !== null && cls.ageMax !== null && age >= cls.ageMin && age <= cls.ageMax
    );
    const assignedClassId = matchByAge?.id ?? null;

    const [child] = await db.insert(childrenTable).values({
      familyId: family.id,
      firstName: c.firstName,
      lastName: c.lastName,
      dob: c.dob,
      gender: c.gender as "male" | "female",
      currentClassId: assignedClassId,
    }).returning();

    if (assignedClassId) {
      for (const slot of slotsToBook) {
        await db.insert(attendanceTable).values({
          childId: child.id,
          classId: assignedClassId,
          serviceDate,
          serviceSlot: slot,
          checkInTime: new Date(),
          checkedInBy: req.user!.userId,
          status: "dropped_off",
        });
      }
    }

    const assignedClass = assignedClassId ? allClasses.find(cls => cls.id === assignedClassId) ?? null : null;
    createdChildren.push({ ...child, currentClass: assignedClass });
  }

  res.status(201).json({
    success: true,
    guestCode,
    family,
    children: createdChildren,
    parentName,
    parentPhone: parentPhone ?? null,
  });
});

export default router;
