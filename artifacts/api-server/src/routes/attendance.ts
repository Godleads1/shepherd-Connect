import { Router } from "express";
import { eq, and, ne, lt, inArray, sql } from "drizzle-orm";
import { db, attendanceTable, attendanceEventsTable, childrenTable, classesTable, familiesTable, usersTable, notificationsTable, teachersTable, teacherAllocationsTable, hallSessionsTable, dropOffIntentsTable } from "@workspace/db";
import { CheckInBody, CheckOutBody, ListAttendanceQueryParams, ScanQrCodeBody } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { notifyChildArrivedInClass, notifyChildPickedUp, notifyTeachersChildPickedUp, sendNotification } from "../lib/notify";
import { smsChildCheckedIn, smsChildCheckedOut, smsPreDismissal, emailChildCheckedIn, emailChildCheckedOut } from "../services/sms";
import { pushToUsers } from "../services/push";
import { getParentChildIds } from "../lib/parentScope";
import { resolveDropOffIntentIfFulfilled } from "../lib/dropOffIntentCompletion";
import { findActiveOtherSlot, stillCheckedInMessage } from "../lib/attendanceGuards";
import { createAttendanceNotificationIntents } from "../lib/attendanceNotificationIntents";

async function getParentContacts(childId: number): Promise<{ phones: (string | null)[]; emails: (string | null)[]; parentIds: number[]; childName: string; className: string }> {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return { phones: [], emails: [], parentIds: [], childName: "Your child", className: "class" };

  const childName = `${child.firstName} ${child.lastName}`;

  let className = "class";
  if (child.currentClassId) {
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
    if (cls) className = cls.name;
  }

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
  if (!family) return { phones: [], emails: [], parentIds: [], childName, className };

  // Batch both parents in one query instead of two separate queries
  const parentIds = [family.parent1Id, family.parent2Id].filter(Boolean) as number[];
  const parents = parentIds.length
    ? await db.select({ phone: usersTable.phone, email: usersTable.email }).from(usersTable)
        .where(inArray(usersTable.id, parentIds))
    : [];

  return { phones: parents.map(p => p.phone), emails: parents.map(p => p.email), parentIds, childName, className };
}

const router = Router();

const WAT_OFFSET_MS = 60 * 60 * 1000;

export function watServiceDateAt(date: Date): string {
  return new Date(date.getTime() + WAT_OFFSET_MS).toISOString().slice(0, 10);
}

export function attendanceEventValidationError(input: {
  originatingUserId: number;
  authenticatedUserId: number;
  originatingRole: string;
  authenticatedRole: string;
  queuedAt: Date;
  now: Date;
  serviceDate: string;
}): string | null {
  if (input.originatingUserId !== input.authenticatedUserId) {
    return "originatingUserId must match the authenticated user";
  }
  if (input.originatingRole !== input.authenticatedRole) {
    return "originatingRole must match the authenticated role";
  }
  if (!Number.isFinite(input.queuedAt.getTime())) return "queuedAt must be a valid timestamp";
  const age = input.now.getTime() - input.queuedAt.getTime();
  if (age < 0) return "queuedAt cannot be in the future";
  if (age > 24 * 60 * 60 * 1000) return "Attendance events must be no more than 24 hours old";
  if (input.serviceDate !== watServiceDateAt(input.now)) {
    return "serviceDate must match the current WAT service date";
  }
  return null;
}

export function processedEventOutcome<T>(record: T): { kind: "duplicate_event"; record: T } {
  return { kind: "duplicate_event", record };
}

/** Returns the class IDs a teacher is allocated to for today. Empty = not assigned. */
async function getTeacherAllocatedClassIds(userId: number): Promise<number[]> {
  const today = watServiceDateAt(new Date());
  const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.userId, userId));
  if (!teacher) return [];
  const allocs = await db
    .select({ classId: teacherAllocationsTable.classId })
    .from(teacherAllocationsTable)
    .where(and(
      eq(teacherAllocationsTable.teacherId, teacher.id),
      eq(teacherAllocationsTable.serviceDate, today),
    ));
  return allocs.map(a => a.classId);
}

// Single-record formatter (for mutation responses — only 1 record, so no N+1)
async function formatAttendance(a: typeof attendanceTable.$inferSelect) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, a.childId));
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, a.classId));
  return { ...a, child: child || null, class: cls || null };
}

// Batch formatter for lists — avoids N+1 queries
async function formatAttendanceBatch(records: (typeof attendanceTable.$inferSelect)[]) {
  if (records.length === 0) return [];
  const childIds = [...new Set(records.map(r => r.childId))];
  const classIds = [...new Set(records.map(r => r.classId))];
  const [children, classes] = await Promise.all([
    db.select().from(childrenTable).where(inArray(childrenTable.id, childIds)),
    db.select().from(classesTable).where(inArray(classesTable.id, classIds)),
  ]);
  const childMap = Object.fromEntries(children.map(c => [c.id, c]));
  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
  return records.map(a => ({ ...a, child: childMap[a.childId] ?? null, class: classMap[a.classId] ?? null }));
}

router.get("/attendance", authMiddleware, async (req, res): Promise<void> => {
  const params = ListAttendanceQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { classId, childId, serviceDate, serviceSlot, status } = params.data;
  const conditions = [];

  // Teachers may only see attendance for classes they are allocated to today.
  if (req.user!.role === "teacher") {
    const allocatedClassIds = await getTeacherAllocatedClassIds(req.user!.userId);
    if (allocatedClassIds.length === 0) {
      res.json([]);
      return;
    }
    if (classId !== undefined) {
      if (!allocatedClassIds.includes(classId)) {
        res.status(403).json({ error: "Forbidden", message: "You are not allocated to this class today" });
        return;
      }
      conditions.push(eq(attendanceTable.classId, classId));
    } else {
      conditions.push(inArray(attendanceTable.classId, allocatedClassIds));
    }
  } else {
    if (classId) conditions.push(eq(attendanceTable.classId, classId));
  }

  // Parents may only see attendance for their own children.
  if (req.user!.role === "parent") {
    const ownChildIds = await getParentChildIds(req.user!.userId);
    if (ownChildIds.length === 0) { res.json([]); return; }
    if (childId !== undefined) {
      if (!ownChildIds.includes(childId)) {
        res.status(403).json({ error: "Forbidden", message: "Access denied" });
        return;
      }
      conditions.push(eq(attendanceTable.childId, childId));
    } else {
      conditions.push(inArray(attendanceTable.childId, ownChildIds));
    }
  } else if (childId) conditions.push(eq(attendanceTable.childId, childId));
  if (serviceDate) conditions.push(eq(attendanceTable.serviceDate, serviceDate));
  if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));
  if (status) conditions.push(eq(attendanceTable.status, status as "dropped_off" | "in_transit" | "in_class" | "picked_up"));
  const records = await db.select().from(attendanceTable)
    .where(conditions.length ? and(...conditions) : undefined);
  const formatted = await formatAttendanceBatch(records);
  res.json(formatted);
});

router.post("/attendance", authMiddleware, requireRoles("super_admin", "admin", "support", "attendant"), async (req, res): Promise<void> => {
  const parsed = CheckInBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { childId, classId, serviceDate, serviceSlot, bothServices } = parsed.data;
  const eventId = parsed.data.eventId;
  const originatingUserId = parsed.data.originatingUserId;
  const originatingRole = parsed.data.originatingRole;
  // `queuedAt` is the client contract name. The event ledger records it as
  // occurredAt, which is the internal timestamp used for replay auditing.
  const occurredAt = parsed.data.queuedAt ? new Date(parsed.data.queuedAt) : null;
  const eventFieldCount = [eventId, originatingUserId, originatingRole, occurredAt].filter((value) => value !== undefined && value !== null).length;
  if (eventFieldCount !== 0 && eventFieldCount !== 4) {
    res.status(400).json({ error: "Bad request", message: "eventId, originatingUserId, originatingRole and queuedAt must be supplied together" });
    return;
  }
  // Serialize every check-in decision for this child+day with a Postgres
  // advisory lock. Without it, two simultaneous requests for OPPOSING slots
  // could both pass the cross-service guard below before either writes,
  // leaving the child actively checked in for two services at once.
  const lockKey = Number(serviceDate.replace(/-/g, ""));
  type CheckInOutcome =
    | { kind: "blocked"; blockingSlot: string }
    | { kind: "existing"; record: typeof attendanceTable.$inferSelect }
    | { kind: "duplicate_event"; record: typeof attendanceTable.$inferSelect }
    | { kind: "reset"; record: typeof attendanceTable.$inferSelect }
    | { kind: "created"; record: typeof attendanceTable.$inferSelect };
  let outcome: CheckInOutcome;
  try {
    outcome = await db.transaction(async (tx): Promise<CheckInOutcome> => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${childId}, ${lockKey})`);
      if (eventId && originatingUserId !== undefined && originatingRole && occurredAt) {
        const clock = await tx.execute(sql`
          SELECT CURRENT_TIMESTAMP AS now,
                 (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date::text AS service_date
        `);
        const dbNow = new Date((clock.rows[0] as { now: Date | string }).now);
        const dbServiceDate = (clock.rows[0] as { service_date: string }).service_date;
        const validationError = attendanceEventValidationError({
          originatingUserId,
          authenticatedUserId: req.user!.userId,
          originatingRole,
          authenticatedRole: req.user!.role,
          queuedAt: occurredAt,
          now: dbNow,
          serviceDate,
        });
        if (validationError || dbServiceDate !== serviceDate) {
          throw Object.assign(new Error(validationError ?? "serviceDate must match the current WAT service date"), { statusCode: 400 });
        }
        // Duplicate replay is resolved only after every authoritative validation,
        // but before mutable attendance state (including opposing-slot guards).
        const [processed] = await tx.select().from(attendanceEventsTable).where(and(
          eq(attendanceEventsTable.userId, originatingUserId),
          eq(attendanceEventsTable.eventId, eventId),
          eq(attendanceEventsTable.operation, "check_in"),
        ));
        if (processed) {
          if (!processed.attendanceId) throw new Error("Processed attendance event has no attendance record");
          const [prior] = await tx.select().from(attendanceTable).where(eq(attendanceTable.id, processed.attendanceId));
          if (!prior) throw new Error("Processed attendance event attendance record was not found");
          return processedEventOutcome(prior);
        }
      }
      const dayRecords = await tx.select().from(attendanceTable)
        .where(and(eq(attendanceTable.childId, childId), eq(attendanceTable.serviceDate, serviceDate)));
      const existing = dayRecords.find((r) => r.serviceSlot === serviceSlot);
      // A child still checked in (not picked up) for a DIFFERENT service today
      // cannot be checked in again — staff must check them out of the first
      // service first. A deliberate "both services" drop-off booking is exempt.
      const blockingSlot = bothServices ? null : findActiveOtherSlot(dayRecords, serviceSlot);
      if ((!existing || existing.status === "picked_up") && blockingSlot) {
        return { kind: "blocked", blockingSlot };
      }
      let claimedEventId: number | null = null;
      if (eventId && originatingUserId !== undefined && originatingRole && occurredAt) {
        const [claimed] = await tx.insert(attendanceEventsTable).values({
          userId: originatingUserId,
          eventId,
          operation: "check_in",
          serviceDate,
          occurredAt,
        }).onConflictDoNothing().returning({ id: attendanceEventsTable.id });
        if (!claimed) {
          const [processed] = await tx.select().from(attendanceEventsTable).where(and(
            eq(attendanceEventsTable.userId, originatingUserId),
            eq(attendanceEventsTable.eventId, eventId),
            eq(attendanceEventsTable.operation, "check_in"),
          ));
          if (!processed?.attendanceId) throw new Error("Processed attendance event has no attendance record");
          const [prior] = await tx.select().from(attendanceTable).where(eq(attendanceTable.id, processed.attendanceId));
          if (!prior) throw new Error("Processed attendance event attendance record was not found");
          return processedEventOutcome(prior);
        }
        claimedEventId = claimed.id;
      }
      const finishEvent = async (record: typeof attendanceTable.$inferSelect) => {
        if (claimedEventId !== null) {
          await tx.update(attendanceEventsTable)
            .set({ attendanceId: record.id })
            .where(eq(attendanceEventsTable.id, claimedEventId));
        }
      };
      if (existing) {
        if (existing.status !== "picked_up") {
          await finishEvent(existing);
          return { kind: "existing", record: existing };
        }
        // Child was already picked up — reset for a new drop-off (e.g. second service,
        // or correcting a premature checkout). Treat this as a fresh check-in.
        const [reset] = await tx.update(attendanceTable).set({
          status: "dropped_off",
          checkInTime: new Date(),
          checkedInBy: req.user!.userId,
          checkOutTime: null,
          escortTime: null,
          classArrivalTime: null,
          confirmedByTeacherId: null,
        }).where(eq(attendanceTable.id, existing.id)).returning();
        await createAttendanceNotificationIntents(tx, reset, "checked_in_reset");
        await finishEvent(reset);
        return { kind: "reset", record: reset };
      }
      const [inserted] = await tx.insert(attendanceTable).values({
        childId, classId, serviceDate, serviceSlot,
        checkedInBy: req.user!.userId,
        checkInTime: new Date(),
        status: "dropped_off",
      }).returning();
      await createAttendanceNotificationIntents(tx, inserted, "checked_in");
      await finishEvent(inserted);
      return { kind: "created", record: inserted };
    });
  } catch (err: any) {
    if (err?.statusCode === 400) {
      res.status(400).json({ error: "Bad request", message: err.message });
      return;
    }
    if (err?.code === "23505") {
      // Unique-constraint race with a writer that doesn't take the advisory
      // lock (e.g. the WhatsApp bot). Return the winning record so the UI
      // still shows a success state.
      const [race] = await db.select().from(attendanceTable)
        .where(and(eq(attendanceTable.childId, childId), eq(attendanceTable.serviceDate, serviceDate), eq(attendanceTable.serviceSlot, serviceSlot)));
      if (race) { res.json(await formatAttendance(race)); return; }
    }
    throw err;
  }

  if (outcome.kind === "blocked") {
    res.status(409).json({ error: "Conflict", message: stillCheckedInMessage(outcome.blockingSlot, serviceSlot) });
    return;
  }
  if (outcome.kind === "reset") {
    const reset = outcome.record;
    res.json(await formatAttendance(reset));
    return;
  }
  if (outcome.kind === "existing" || outcome.kind === "duplicate_event") {
    const existing = outcome.record;
    res.json(await formatAttendance(existing));
    return;
  }
  const record = outcome.record;

  // Resolve the family's "on our way" signal — but only once every intended
  // child/slot in the selection is checked in (partial check-ins keep it open)
  db.select().from(childrenTable).where(eq(childrenTable.id, childId)).then(async ([child]) => {
    if (!child?.familyId) return;
    await resolveDropOffIntentIfFulfilled(child.familyId, serviceDate);
  }).catch(() => {});

  res.status(201).json(await formatAttendance(record));
});

/**
 * POST /attendance/bulk-escort
 * Transitions ALL dropped_off children for today → in_transit in one action.
 * Fires parent + teacher notifications for each child asynchronously.
 * Also clears any active hall session for today so future en-route messages
 * revert to the normal "being escorted to class" wording.
 */
router.post("/attendance/bulk-escort", authMiddleware, requireRoles("super_admin", "admin", "support", "attendant"), async (req, res): Promise<void> => {
  const { serviceDate, serviceSlot } = req.body as { serviceDate?: string; serviceSlot?: "7am" | "10:30am" };
  const today = serviceDate ?? watServiceDateAt(new Date());
  const now = new Date();

  const conditions = [
    eq(attendanceTable.serviceDate, today),
    eq(attendanceTable.status, "dropped_off"),
  ];
  if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));

  const records = await db.transaction(async tx => {
    const winners = await tx.update(attendanceTable)
      .set({ status: "in_transit", escortTime: now, escortedBy: req.user!.userId })
      .where(and(...conditions)).returning();
    for (const record of winners) await createAttendanceNotificationIntents(tx, record, "in_transit");
    return winners;
  });

  // Auto-clear the hall session for today so subsequent escort notifications
  // revert to normal wording ("being escorted to class")
  db.delete(hallSessionsTable)
    .where(eq(hallSessionsTable.serviceDate, today))
    .catch((err) => req.log.warn({ err }, "bulk-escort: could not clear hall sessions"));

  req.log.info({ count: records.length, today, serviceSlot }, "bulk-escort: dispatched all dropped-off children");
  res.json({ success: true, count: records.length });
});

router.put("/attendance/:id/escort", authMiddleware, requireRoles("super_admin", "admin", "support", "attendant"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [record] = await db.transaction(async tx => {
    const result = await tx.update(attendanceTable).set({
      status: "in_transit", escortTime: new Date(), escortedBy: req.user!.userId,
    }).where(and(eq(attendanceTable.id, id), eq(attendanceTable.status, "dropped_off"))).returning();
    if (result[0]) await createAttendanceNotificationIntents(tx, result[0], "in_transit");
    return result;
  });
  if (!record) { res.status(404).json({ error: "Not found", message: "Attendance record not found or not in dropped_off state" }); return; }

  res.json(await formatAttendance(record));
});

/**
 * POST /attendance/bulk-arrive
 * Confirms ALL in_transit children for a given class → in_class in one action.
 * Teachers use this after a bulk escort so they don't have to tap each child individually.
 * Fires notifyChildArrivedInClass for every confirmed child.
 */
router.post("/attendance/bulk-arrive", authMiddleware, requireRoles("super_admin", "admin", "teacher", "support", "attendant"), async (req, res): Promise<void> => {
  const { classId, serviceDate } = req.body as { classId?: number; serviceDate?: string };
  if (!classId) { res.status(400).json({ error: "Bad request", message: "classId is required" }); return; }

  const today = serviceDate ?? watServiceDateAt(new Date());

  // Teachers may only confirm arrivals for their allocated class
  if (req.user!.role === "teacher") {
    const allocatedClassIds = await getTeacherAllocatedClassIds(req.user!.userId);
    if (!allocatedClassIds.includes(classId)) {
      res.status(403).json({ error: "Forbidden", message: "You are not allocated to this class today" });
      return;
    }
  }

  const records = await db.transaction(async tx => {
    const winners = await tx.update(attendanceTable).set({
      status: "in_class",
      classArrivalTime: new Date(),
      confirmedByTeacherId: req.user!.userId,
    })
    .where(and(
      eq(attendanceTable.classId, classId),
      eq(attendanceTable.serviceDate, today),
      // dropped_off children who never got the escort step can also be confirmed in bulk
      inArray(attendanceTable.status, ["in_transit", "dropped_off"]),
    )).returning();
    for (const record of winners) await createAttendanceNotificationIntents(tx, record, "arrived");
    return winners;
  });

  req.log.info({ count: records.length, classId, today }, "bulk-arrive: confirmed all in-transit children");
  res.json({ success: true, count: records.length });
});

/** Business day in West Africa Time (UTC+1). */
function todayWAT(): string {
  return watServiceDateAt(new Date());
}

/**
 * GET /attendance/stale
 * Staff view of unresolved records from previous service days —
 * children still marked dropped_off / in_transit after the day ended.
 */
router.get("/attendance/stale", authMiddleware, requireRoles("super_admin", "admin", "support", "attendant"), async (_req, res): Promise<void> => {
  const records = await db.select().from(attendanceTable)
    .where(and(
      lt(attendanceTable.serviceDate, todayWAT()),
      inArray(attendanceTable.status, ["dropped_off", "in_transit"]),
    ));
  res.json(await Promise.all(records.map(formatAttendance)));
});

/**
 * POST /attendance/resolve-stale
 * Closes out all stale records from previous days by marking them picked_up.
 * The children clearly went home; the records were just never closed.
 * No parent notifications are sent (the pickup happened days ago).
 */
router.post("/attendance/resolve-stale", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const records = await db.update(attendanceTable)
    .set({
      status: "picked_up",
      checkOutTime: new Date(),
      checkedOutBy: req.user!.userId,
    })
    .where(and(
      lt(attendanceTable.serviceDate, todayWAT()),
      inArray(attendanceTable.status, ["dropped_off", "in_transit"]),
    ))
    .returning();

  req.log.info({ count: records.length, resolvedBy: req.user!.userId }, "resolve-stale: closed out stale attendance records");
  res.json({ success: true, count: records.length });
});

router.put("/attendance/:id/arrive", authMiddleware, requireRoles("super_admin", "admin", "teacher", "support", "attendant"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [existing] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found", message: "Attendance record not found" }); return; }

  // Teachers may only confirm arrivals for children in their allocated class
  if (req.user!.role === "teacher") {
    const allocatedClassIds = await getTeacherAllocatedClassIds(req.user!.userId);
    if (!allocatedClassIds.includes(existing.classId)) {
      res.status(403).json({ error: "Forbidden", message: "You are not allocated to this class today" });
      return;
    }
  }
  if (existing.status === "in_class" || existing.status === "picked_up") {
    res.json(await formatAttendance(existing));
    return;
  }

  const now = new Date();
  const [record] = await db.transaction(async tx => {
    const result = await tx.update(attendanceTable).set({
      status: "in_class", classArrivalTime: now, confirmedByTeacherId: req.user!.userId,
    }).where(and(
      eq(attendanceTable.id, id), inArray(attendanceTable.status, ["dropped_off", "in_transit"]),
    )).returning();
    if (result[0]) await createAttendanceNotificationIntents(tx, result[0], "arrived");
    return result;
  });

  if (!record) {
    const [current] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id));
    if (!current) { res.status(404).json({ error: "Not found", message: "Attendance record not found" }); return; }
    res.json(await formatAttendance(current));
    return;
  }

  res.json(await formatAttendance(record));
});

router.put("/attendance/:id/checkout", authMiddleware, requireRoles("super_admin", "admin", "support", "attendant"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = CheckOutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const [record] = await db.transaction(async tx => {
    const result = await tx.update(attendanceTable).set({
      status: "picked_up", checkOutTime: new Date(), checkedOutBy: req.user!.userId,
    }).where(and(eq(attendanceTable.id, id), ne(attendanceTable.status, "picked_up"))).returning();
    if (result[0]) await createAttendanceNotificationIntents(tx, result[0], "picked_up");
    return result;
  });
  if (!record) {
    const [current] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id));
    if (!current) { res.status(404).json({ error: "Not found", message: "Attendance record not found" }); return; }
    res.json(await formatAttendance(current));
    return;
  }

  res.json(await formatAttendance(record));
});

router.post(
  "/attendance/scan-qr",
  authMiddleware,
  requireRoles("super_admin", "admin", "support", "attendant"),
  async (req, res): Promise<void> => {
  const parsed = ScanQrCodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { qrCode, serviceDate, serviceSlot } = parsed.data;
  let family = null;
  let children: typeof childrenTable.$inferSelect[] = [];
  const qrParts = qrCode.trim().split(":");
  if (qrParts[0] === "QR" && qrParts.length >= 2) {
    const familyId = parseInt(qrParts[1], 10);
    if (!isNaN(familyId)) {
      const [f] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
      family = f ?? null;
      if (family) children = await db.select().from(childrenTable).where(eq(childrenTable.familyId, familyId));
    }
  }
  if (!family && qrCode.trim().toUpperCase().startsWith("FAM-")) {
    const code = qrCode.trim().toUpperCase();
    const [f] = await db.select().from(familiesTable).where(eq(familiesTable.familyCode, code));
    family = f ?? null;
    if (family) children = await db.select().from(childrenTable).where(eq(childrenTable.familyId, family.id));
  }
  if (!family) {
    res.status(404).json({ error: "Not found", message: "QR code not recognized" });
    return;
  }
  const alerts: string[] = [];
  const childrenWithDetails = await Promise.all(children.map(async (child) => {
    const dob = new Date(child.dob);
    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear() -
      (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    if (child.allergies) alerts.push(`${child.firstName} has allergies: ${child.allergies}`);
    if (child.medicalNotes) alerts.push(`${child.firstName} has medical notes`);
    let currentClass = null;
    if (child.currentClassId) {
      const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
      currentClass = cls || null;
    }
    const recentAttendance = await db.select().from(attendanceTable)
      .where(eq(attendanceTable.childId, child.id))
      .orderBy(attendanceTable.serviceDate)
      .limit(5);
    // Auto-heal: if still unassigned, assign by age now and persist
    if (!currentClass && age >= 1 && age <= 12) {
      const [matched] = await db.select().from(classesTable).where(eq(classesTable.ageMin, age));
      if (matched) {
        await db.update(childrenTable).set({ currentClassId: matched.id }).where(eq(childrenTable.id, child.id));
        currentClass = matched;
      }
    }
    const lastAttendance = recentAttendance.length > 0 ? recentAttendance[recentAttendance.length - 1] : null;
    return { ...child, age, currentClass, teacher: null, lastAttendance, attendanceHistory: recentAttendance };
  }));
  // Enrich family with parent name for the check-in UI
  let parent1: { firstName: string; lastName: string } | null = null;
  if (family.parent1Id) {
    const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, family.parent1Id));
    if (u) parent1 = u;
  }
  // Pre-initiated drop-off: if the family signalled "on our way" today, the scan
  // IS the handover — auto check-in the selected children for the selected
  // service(s) and move them straight to in_transit (being escorted to class).
  let autoProcessed: { childId: number; childName: string; slots: string[] }[] = [];
  const staffRoles = ["super_admin", "admin", "support", "attendant"];
  if (staffRoles.includes(req.user!.role)) {
    // Intents are keyed to the WAT business day server-side; ignore the client's
    // local date to avoid midnight/timezone mismatches.
    const scanDate = todayWAT();
    const [intent] = await db.select().from(dropOffIntentsTable)
      .where(and(
        eq(dropOffIntentsTable.familyId, family.id),
        eq(dropOffIntentsTable.serviceDate, scanDate),
        eq(dropOffIntentsTable.status, "on_the_way"),
      ));
    if (intent) {
      const intended = childrenWithDetails.filter(c =>
        c.currentClass && (!intent.childIds || intent.childIds.length === 0 || intent.childIds.includes(c.id)));
      const slots: ("7am" | "10:30am")[] =
        intent.serviceSlot === "both" ? ["7am", "10:30am"] : [intent.serviceSlot];
      const now = new Date();
      const scanLockKey = Number(scanDate.replace(/-/g, ""));
      for (const child of intended) {
        // Same per-child/day advisory lock as the manual check-in endpoint so
        // concurrent requests can't bypass the cross-service rule.
        const processed: { slot: "7am" | "10:30am"; escorted: boolean }[] = [];
        await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${child.id}, ${scanLockKey})`);
          const childDayRecords = await tx
            .select({ serviceSlot: attendanceTable.serviceSlot, status: attendanceTable.status })
            .from(attendanceTable)
            .where(and(eq(attendanceTable.childId, child.id), eq(attendanceTable.serviceDate, scanDate)));
          // A single-service intent must not auto check-in a child who is still
          // checked in (not picked up) for the other service — staff must check
          // them out first via the manual flow, where the block is explained.
          // "both" intents deliberately book both services at drop-off.
          if (slots.length === 1 && findActiveOtherSlot(childDayRecords, slots[0])) return;
          for (const slot of slots) {
            // Skip silently if already checked in for this slot. The lock makes
            // this existence check race-free.
            if (childDayRecords.some((r) => r.serviceSlot === slot)) continue;
            const [record] = await tx.insert(attendanceTable).values({
              childId: child.id,
              classId: child.currentClass!.id,
              serviceDate: scanDate,
              serviceSlot: slot,
              checkedInBy: req.user!.userId,
              checkInTime: now,
              status: "dropped_off",
            }).returning();
            await createAttendanceNotificationIntents(tx, record, "checked_in");
            // Straight to in_transit: the scan means the parent has handed over the child
            const [escorted] = await tx.update(attendanceTable)
              .set({ status: "in_transit", escortTime: now, escortedBy: req.user!.userId })
              .where(eq(attendanceTable.id, record.id))
              .returning();
            if (escorted) await createAttendanceNotificationIntents(tx, escorted, "in_transit");
            processed.push({ slot, escorted: !!escorted });
          }
        });
        const doneSlots: string[] = [];
        for (const { slot, escorted } of processed) {
          doneSlots.push(slot);
          void escorted;
        }
        if (doneSlots.length > 0) {
          autoProcessed.push({ childId: child.id, childName: `${child.firstName} ${child.lastName}`, slots: doneSlots });
        }
      }
      // Mark the intent arrived only if the whole selection is now checked in;
      // otherwise it stays open so remaining children/slots can still be processed
      await resolveDropOffIntentIfFulfilled(family.id, scanDate);
    }
  }

  const safeChildren = childrenWithDetails.map(child => ({
    id: child.id,
    firstName: child.firstName,
    lastName: child.lastName,
    age: child.age,
    servicePreference: child.servicePreference,
    allergies: child.allergies,
    currentClass: child.currentClass ? {
      id: child.currentClass.id,
      name: child.currentClass.name,
    } : null,
  }));
  res.json({
    family: { familyCode: family.familyCode, parent1 },
    children: safeChildren,
    hasAlerts: alerts.length > 0,
    alerts,
    autoProcessed,
  });
});

router.post(
  "/attendance/scan-face",
  authMiddleware,
  requireRoles("super_admin", "admin", "support", "attendant"),
  async (req, res): Promise<void> => {
  const { descriptor } = req.body as { descriptor: number[] };
  if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
    res.status(400).json({ error: "Bad request", message: "descriptor must be a 128-element float array" });
    return;
  }
  const allChildren = await db.select({
    id: childrenTable.id,
    familyId: childrenTable.familyId,
    faceDescriptorJson: childrenTable.faceDescriptorJson,
  }).from(childrenTable);
  const enrolled = allChildren.filter(c => c.faceDescriptorJson);

  let bestMatch: typeof allChildren[number] | null = null;
  let bestDist = Infinity;

  for (const child of enrolled) {
    try {
      const stored: number[] = JSON.parse(child.faceDescriptorJson!);
      if (stored.length !== 128) continue;
      const dist = Math.sqrt(stored.reduce((sum, v, i) => sum + Math.pow(v - descriptor[i], 2), 0));
      if (dist < bestDist) { bestDist = dist; bestMatch = child; }
    } catch { continue; }
  }

  if (!bestMatch || bestDist > 0.6) {
    res.status(404).json({ error: "Not found", message: "No matching child found" });
    return;
  }

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, bestMatch.familyId));
  if (!family) { res.status(404).json({ error: "Not found", message: "Family not found" }); return; }

  const familyChildren = await db.select().from(childrenTable).where(eq(childrenTable.familyId, family.id));
  let parent1: { firstName: string; lastName: string } | null = null;
  if (family.parent1Id) {
    const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, family.parent1Id));
    if (u) parent1 = u;
  }
  const alerts: string[] = [];
  const childrenWithDetails = await Promise.all(familyChildren.map(async (child) => {
    const dob = new Date(child.dob);
    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear() -
      (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    if (child.allergies) alerts.push(`${child.firstName} has allergies: ${child.allergies}`);
    if (child.medicalNotes) alerts.push(`${child.firstName} has medical notes`);
    let currentClass = null;
    if (child.currentClassId) {
      const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, child.currentClassId));
      currentClass = cls || null;
    }
    const recentAttendance = await db.select().from(attendanceTable)
      .where(eq(attendanceTable.childId, child.id))
      .orderBy(attendanceTable.serviceDate)
      .limit(5);
    const lastAttendance = recentAttendance.length > 0 ? recentAttendance[recentAttendance.length - 1] : null;
    return { ...child, age, currentClass, teacher: null, lastAttendance, attendanceHistory: recentAttendance };
  }));

  const safeChildren = childrenWithDetails.map(child => ({
    id: child.id,
    firstName: child.firstName,
    lastName: child.lastName,
    age: child.age,
    servicePreference: child.servicePreference,
    allergies: child.allergies,
    currentClass: child.currentClass ? {
      id: child.currentClass.id,
      name: child.currentClass.name,
    } : null,
  }));
  res.json({
    family: { familyCode: family.familyCode, parent1 },
    children: safeChildren,
    hasAlerts: alerts.length > 0,
    alerts,
    matchedChildId: bestMatch.id,
    confidence: Math.max(0, Math.round((1 - bestDist / 0.6) * 100)),
  });
});

// ─── Late Pickup Alerts ───────────────────────────────────────────────────────
router.post("/attendance/late-pickup-alerts", authMiddleware, requireRoles("super_admin", "admin", "support"), async (req, res): Promise<void> => {
  const { serviceDate, serviceSlot } = req.body as { serviceDate?: string; serviceSlot?: string };
  const today = serviceDate || new Date().toISOString().split("T")[0];

  const conditions = [
    eq(attendanceTable.serviceDate, today),
    ne(attendanceTable.status, "picked_up"),
  ];
  if (serviceSlot) conditions.push(eq(attendanceTable.serviceSlot, serviceSlot));

  const presentRecords = await db.select().from(attendanceTable).where(and(...conditions));

  let notified = 0;
  for (const record of presentRecords) {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, record.childId));
    if (!child) continue;
    const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
    if (!family) continue;
    const parentIds = [family.parent1Id, family.parent2Id].filter(Boolean) as number[];
    for (const parentId of parentIds) {
      await sendNotification({
        userId: parentId,
        type: "late_pickup_reminder",
        title: "Late Pickup Reminder",
        message: `${child.firstName} ${child.lastName} is still at church and hasn't been picked up yet. Please collect them as soon as possible.`,
        // A re-run for this attendance slot is idempotent, while a later
        // service/date remains a distinct logical reminder.
        identity: `late-pickup:${record.childId}:${parentId}:${today}:${record.serviceSlot}:whatsapp`,
        metadata: { childId: record.childId, serviceDate: today, serviceSlot: record.serviceSlot },
      });
      notified++;
    }
  }

  res.json({ ok: true, childrenStillPresent: presentRecords.length, notificationsSent: notified });
});

// ─── Attendance Trends ────────────────────────────────────────────────────────
router.get("/attendance/trends", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { weeks = "12" } = req.query as { weeks?: string };
  const numWeeks = Math.min(parseInt(weeks, 10) || 12, 52);

  const now = new Date();
  const trends: { week: string; label: string; total: number; firstService: number; secondService: number; uniqueChildren: number }[] = [];

  for (let i = numWeeks - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - i * 7);
    const dateStr = weekStart.toISOString().split("T")[0];
    const label = weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    const dayRecords = await db.select().from(attendanceTable).where(eq(attendanceTable.serviceDate, dateStr));
    const firstService = dayRecords.filter(r => r.serviceSlot === "7am").length;
    const secondService = dayRecords.filter(r => r.serviceSlot === "10:30am").length;
    const uniqueChildren = new Set(dayRecords.map(r => r.childId)).size;

    trends.push({ week: dateStr, label, total: dayRecords.length, firstService, secondService, uniqueChildren });
  }

  res.json({ weeks: numWeeks, trends });
});

export default router;
